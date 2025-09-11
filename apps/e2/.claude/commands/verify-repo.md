---
description: "Organize repository with only e2.html and e2.pdf in root"
allowed-tools: all
---
Any temporary files created during analysis should be placed in appropriate folders or deleted afterwards.
ULTRATHINK about repository organization and clean up all files, leaving only e2.html and e2.pdf in root.

!echo "Starting repository cleanup..."

Use Task agents to:
1. Identify all files currently in root directory
2. Determine appropriate folder structure based on file types
3. Create necessary directories if they don't exist
4. Move all files except e2.html to their relevant folders

Suggested organization:
- `/data/` - All CSV files and JSON data files
- `/scripts/` - All Python scripts (.py files)
- `/images/` - All image files (PNG, JPG, JPEG, SVG)
- `/backups/` - All backup files and old versions
- `/docs/` - All documentation files (MD, TXT reports, other PDFs except e2.pdf)

!ls -la | grep -v "^d" | grep -v "e2.html$" | grep -v "e2.pdf$"

**CRITICAL: Present reorganization plan for approval**

Show user:
- Current file structure and issues
- Proposed new organization
- Exact commands that would be executed
- Impact analysis (what moves where)

**STOP AND WAIT FOR USER APPROVAL**

Ask clearly: "I've analyzed the repository structure. Here's my proposed reorganization: [detailed plan]. This will move [X] files to organized folders, leaving only e2.html and e2.pdf in root. Would you like me to proceed?"

**ONLY execute moves after explicit user approval**

If approved, execute moves with:
- Move all .csv files to data/
- Move all .py files to scripts/
- Move all image files to images/
- Move all backup/old files to backups/
- Move all reports and docs to docs/
- Keep only e2.html and its PDF version in root

Verify final state:
!ls -la

**IMPORTANT: After moving files, verify all links in e2.html still work:**
- Check all image paths (src="images/...")
- Check all internal anchors (#appendix-*, #section-ids)
- Check all data file references if any
- Fix any broken links caused by file moves

Report what was moved where and confirm all links are functional.