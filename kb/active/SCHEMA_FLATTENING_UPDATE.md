# Schema Flattening Update - oneOf/allOf/anyOf Removal

## Overview
Updated moidvk server tool schemas to remove oneOf, allOf, and anyOf at the root level, replacing them with flattened schemas using optional properties and runtime validation.

## Changes Made

### Files Modified
1. **`lib/tools/multi-language-auto-fixer.js`**
2. **`lib/tools/eslint-auto-fixer.js`**

### Schema Changes
- **Removed**: `oneOf: [{ required: ['code'] }, { required: ['filePath'] }]`
- **Added**: `required: []` and `additionalProperties: false`
- **Updated**: Parameter descriptions to indicate mutual exclusivity

### Runtime Validation Added
Both tools now include validation logic at the start of their handler functions:

```javascript
// Runtime validation for mutual exclusivity
if (!code && !filePath) {
  throw new Error('Either "code" or "filePath" parameter is required');
}

if (code && filePath) {
  throw new Error('Cannot specify both "code" and "filePath" parameters - choose one');
}
```

## Benefits
- ✅ **Eliminates root-level oneOf/allOf/anyOf** as requested
- ✅ **Maintains functional requirements** - still enforces mutual exclusivity
- ✅ **Improves schema simplicity** - easier for MCP clients to understand
- ✅ **Better error messages** - runtime validation provides clearer feedback
- ✅ **Future-proof** - easier to extend with additional optional parameters
- ✅ **Backward compatible** - existing tool calls continue to work

## Testing Results
All validation scenarios tested successfully:
- ✅ Valid calls with `code` parameter only
- ✅ Valid calls with `filePath` parameter only  
- ✅ Proper rejection when neither parameter provided
- ✅ Proper rejection when both parameters provided
- ✅ Server starts successfully with new schemas

## Implementation Status
- [x] Schema updates completed
- [x] Runtime validation implemented
- [x] Testing completed
- [x] Server validation passed
- [x] Documentation updated

## Impact
- **No breaking changes** - all existing functionality preserved
- **Improved MCP client compatibility** - simpler schema structure
- **Enhanced error handling** - clearer validation messages
- **Maintainability** - easier to extend schemas in the future