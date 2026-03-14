# SOP: Version Update Procedure

## Goal
Update the project versioning across all relevant files consistently.  This is done when we begin working on a new version of the project.

## Inputs
- `new_version`: The specific version number (e.g., 1.2.0)

## Execution Steps
1. **Update README.md**: Locate the version header and update it to `new_version`. 
2. **Update Scripts**: Update to the 'new_version' in the splash screen and help/shortcut info panel.
3. **Log the Change**: Add a line to the project's changelog in the README.md and changelog.md with the new version number but do not add any other information.  Do not add any details to the changelog.  That will be done later.

## Error Handling
- If the `README.md` is missing a version section, ask the user where the version should be recorded.
- If multiple versions are found in different files, stop and ask which is the source of truth.