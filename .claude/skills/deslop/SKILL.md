---
name: deslop
description: Remove AI-generated code slop like unnecessary comments, defensive checks, and style inconsistencies. Use when cleaning up AI-generated code or ensuring code matches project style.
---

# Remove AI code slop

Check the diff against `main`, and remove all AI generated slop introduced in this branch.

This includes:

- Extra comments that a human wouldn't add or is inconsistent with the rest of the file
- Functions with sufficiently descriptive names that make additional comments unnecessary.
- Extra defensive checks or try/catch blocks that are abnormal for that area of the codebase (especially if called by trusted / validated codepaths)
- Casts to any to get around type issues
- Any other style that is inconsistent with the file
- unnecessary void statements

Report at the end with only a 1-3 sentence summary of what you changed

## Deslop Checklist

- [ ] Removed unnecessary or overly verbose comments
- [ ] Removed redundant defensive checks and try/catch blocks
- [ ] Eliminated unsafe `any` casts and quick type escapes
- [ ] Aligned style and naming with surrounding code
