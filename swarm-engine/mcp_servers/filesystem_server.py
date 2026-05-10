"""
FileSystem MCP Server

Provides scoped Read/Write access to target project source files.
Used by the Debugger agent to read crash context and by the
Deployer agent to write patched code.

Supports dynamic target path configuration — can scope to any project directory.

Security: All operations are restricted to the configured allowed directories.
"""
import os
import sys
from pathlib import Path
from typing import Optional, List

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CONTEXT_LINES


class FileSystemMCP:
    """
    MCP Server providing scoped filesystem access to target project source files.
    Supports dynamic reconfiguration for different target projects.
    """

    def __init__(self, target_dir: str = None):
        # Default: use config values
        if target_dir:
            self._configure_for_path(Path(target_dir))
        else:
            from config import TARGET_API_DIR, CONTROLLERS_DIR, ROUTES_DIR
            self.base_dir = Path(TARGET_API_DIR).resolve()
            self.allowed_dirs = [
                Path(CONTROLLERS_DIR).resolve(),
                Path(ROUTES_DIR).resolve(),
            ]

    def configure(self, target_dir: str, allowed_subdirs: List[str] = None):
        """
        Reconfigure for a new target directory at runtime.
        
        Args:
            target_dir: Absolute path to the project root
            allowed_subdirs: List of subdirectory names to allow access to.
                           Defaults to auto-detection of common source dirs.
        """
        self._configure_for_path(Path(target_dir), allowed_subdirs)

    def _configure_for_path(self, target_path: Path, allowed_subdirs: List[str] = None):
        """Set up scoping for a given project path."""
        self.base_dir = target_path.resolve()
        
        if allowed_subdirs:
            self.allowed_dirs = [
                (self.base_dir / sub).resolve()
                for sub in allowed_subdirs
                if (self.base_dir / sub).exists()
            ]
        else:
            # Auto-detect common source directories
            self.allowed_dirs = self._auto_detect_source_dirs()
        
        if not self.allowed_dirs:
            # Fallback: allow entire project (less secure, but functional)
            self.allowed_dirs = [self.base_dir]
            print(f"[FileSystem MCP] WARNING: No source subdirs detected, allowing entire project dir")
        
        print(f"[FileSystem MCP] Configured: {self.base_dir}")
        print(f"[FileSystem MCP] Allowed dirs: {[str(d.relative_to(self.base_dir)) for d in self.allowed_dirs]}")

    def _auto_detect_source_dirs(self) -> List[Path]:
        """Auto-detect common source code directories in a project."""
        candidates = [
            "controllers", "routes", "handlers", "middleware",
            "src", "lib", "api", "app", "server",
            "src/controllers", "src/routes", "src/handlers",
            "src/api", "src/lib", "src/app",
        ]
        detected = []
        for candidate in candidates:
            candidate_path = (self.base_dir / candidate).resolve()
            if candidate_path.exists() and candidate_path.is_dir():
                detected.append(candidate_path)
        return detected

    def _validate_path(self, filepath: str) -> Path:
        """Ensure the path is within allowed directories."""
        resolved = Path(filepath)
        if not resolved.is_absolute():
            resolved = (self.base_dir / filepath).resolve()
        else:
            resolved = resolved.resolve()

        # Security check
        is_allowed = any(
            str(resolved).startswith(str(allowed))
            for allowed in self.allowed_dirs
        )
        if not is_allowed:
            raise PermissionError(
                f"Access denied: {filepath} is outside allowed scope. "
                f"Allowed: {[str(d) for d in self.allowed_dirs]}"
            )
        return resolved

    def read_file(self, filepath: str) -> str:
        """Read the entire contents of a file."""
        path = self._validate_path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")
        return path.read_text(encoding='utf-8')

    def read_file_context(self, filepath: str, line: int, context: int = None) -> dict:
        """
        Read lines surrounding a specific line number.
        Returns the context with line numbers for the Debugger agent.
        """
        if context is None:
            context = CONTEXT_LINES

        content = self.read_file(filepath)
        lines = content.split('\n')
        total_lines = len(lines)

        start = max(0, line - context // 2)
        end = min(total_lines, line + context // 2)

        context_lines = []
        for i in range(start, end):
            context_lines.append({
                "line_number": i + 1,
                "content": lines[i],
                "is_error_line": (i + 1) == line
            })

        return {
            "filepath": filepath,
            "total_lines": total_lines,
            "context_start": start + 1,
            "context_end": end,
            "error_line": line,
            "lines": context_lines,
            "full_content": content
        }

    def write_file(self, filepath: str, content: str) -> dict:
        """Write content to a file (overwrite). Returns a diff summary."""
        path = self._validate_path(filepath)
        
        original = ""
        if path.exists():
            original = path.read_text(encoding='utf-8')
        
        path.write_text(content, encoding='utf-8')

        return {
            "filepath": str(path),
            "original_size": len(original),
            "new_size": len(content),
            "original_lines": len(original.split('\n')),
            "new_lines": len(content.split('\n')),
            "success": True
        }

    def patch_file(self, filepath: str, original_snippet: str, patched_snippet: str) -> dict:
        """
        Patch a specific section of a file by replacing a code snippet.
        More surgical than write_file — preserves the rest of the file.
        """
        path = self._validate_path(filepath)
        content = self.read_file(filepath)

        if original_snippet not in content:
            raise ValueError(
                f"Original code snippet not found in {filepath}. "
                f"Expected:\n{original_snippet[:200]}..."
            )

        patched_content = content.replace(original_snippet, patched_snippet, 1)
        return self.write_file(filepath, patched_content)

    def list_files(self, directory: str = None, extensions: List[str] = None) -> List[dict]:
        """List source files in the allowed directories."""
        if extensions is None:
            extensions = [".js", ".ts", ".py", ".jsx", ".tsx", ".mjs"]
        
        results = []
        dirs_to_scan = self.allowed_dirs if directory is None else [self._validate_path(directory)]
        
        for scan_dir in dirs_to_scan:
            if scan_dir.exists():
                for ext in extensions:
                    for f in scan_dir.rglob(f"*{ext}"):
                        # Skip node_modules, dist, build
                        if any(skip in str(f) for skip in ["node_modules", "dist", "build", ".git"]):
                            continue
                        try:
                            results.append({
                                "filepath": str(f),
                                "relative": str(f.relative_to(self.base_dir)),
                                "size": f.stat().st_size,
                                "modified": os.path.getmtime(f)
                            })
                        except (OSError, ValueError):
                            continue
        return results

    def get_scope_info(self) -> dict:
        """Return current scope configuration for the dashboard."""
        return {
            "base_dir": str(self.base_dir),
            "allowed_dirs": [str(d) for d in self.allowed_dirs],
            "allowed_relative": [
                str(d.relative_to(self.base_dir)) for d in self.allowed_dirs
                if str(d).startswith(str(self.base_dir))
            ],
            "file_count": len(self.list_files()),
        }
