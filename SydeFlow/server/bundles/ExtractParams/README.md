# ExtractParams Bundle

This Design Automation bundle extracts user parameters from Inventor files (IPT/IAM) and outputs them as JSON.

## Purpose

Automatically discover all user-defined parameters in an Inventor file to:
- Pre-populate the parameter configuration in Product Manager
- Reduce manual data entry when setting up new products
- Ensure parameter names match exactly what's in the Inventor file

## Bundle Structure

```
ExtractParamsBundle.zip
├── PackageContents.xml
└── Contents/
    └── ExtractParams.iLogicVb
```

## Setup Instructions

### 1. Create the Bundle ZIP

```bash
# From the ExtractParams directory, create the bundle structure
mkdir -p Contents
cp ExtractParams.iLogicVb Contents/
zip -r ExtractParamsBundle.zip PackageContents.xml Contents/
```

Or in PowerShell:
```powershell
# Create Contents folder and copy iLogic code
New-Item -ItemType Directory -Force -Path Contents
Copy-Item ExtractParams.iLogicVb Contents/
# Create ZIP
Compress-Archive -Path PackageContents.xml, Contents -DestinationPath ExtractParamsBundle.zip -Force
```

### 2. Upload AppBundle

Use the Admin Console > Design Automation view:

1. Go to "App Bundles" section
2. Click "Upload Bundle"
3. Enter Bundle Name: `ExtractParamsBundle`
4. Select the `ExtractParamsBundle.zip` file
5. Click "Create"

### 3. Create Activity

Create an activity with:

- **Activity Name**: `ExtractParamsActivity`
- **Engine**: `Autodesk.Inventor+2024` (or your version)
- **AppBundle**: `YourNickname.ExtractParamsBundle+prod`
- **Command Line**: 
  ```
  $(engine.path)\\InventorCoreConsole.exe /al "$(appbundles[ExtractParamsBundle].path)" /i "$(args[inputFile].path)"
  ```
- **Arguments**:
  - `inputFile`: Input file (IPT or IAM)
  - `outputJson`: Output JSON file with extracted parameters

### 4. Activity JSON Example

```json
{
  "commandLine": [
    "$(engine.path)\\InventorCoreConsole.exe",
    "/al", "$(appbundles[ExtractParamsBundle].path)",
    "/i", "$(args[inputFile].path)"
  ],
  "parameters": {
    "inputFile": {
      "verb": "get",
      "description": "Input Inventor file (IPT/IAM)",
      "required": true,
      "localName": "input.ipt"
    },
    "outputJson": {
      "verb": "put",
      "description": "Output JSON with extracted parameters",
      "required": true,
      "localName": "parameters.json"
    }
  },
  "engine": "Autodesk.Inventor+2024",
  "appbundles": ["YourNickname.ExtractParamsBundle+prod"],
  "description": "Extracts user parameters from Inventor files"
}
```

## Output Format

The extraction produces JSON like this:

```json
{
  "fileName": "Wardrobe.ipt",
  "fileType": "IPT",
  "parameters": [
    {
      "name": "Width",
      "displayName": "Width",
      "type": "number",
      "defaultValue": 1200,
      "unit": "mm",
      "group": "Dimensions"
    },
    {
      "name": "Height",
      "displayName": "Height", 
      "type": "number",
      "defaultValue": 2400,
      "unit": "mm",
      "min": 1800,
      "max": 3000,
      "group": "Dimensions"
    },
    {
      "name": "DoorCount",
      "displayName": "Door Count",
      "type": "number",
      "defaultValue": 3,
      "group": "Quantity"
    }
  ],
  "extractedAt": "2024-01-15T10:30:00.000Z",
  "parameterCount": 3
}
```

## Alternative: Quick Extract

If you don't want to set up the full Design Automation workflow, you can use "Quick Extract" in Product Manager which:

1. Uses the Model Derivative API
2. Requires the file to be translated first (click "View" in OSS Manager)
3. Extracts properties from the viewable model

Note: Quick Extract may not capture all Inventor-specific parameters and is less reliable for complex models.

## Troubleshooting

### Activity Not Found
- Ensure the activity name is exactly `ExtractParamsActivity`
- Check that your nickname/alias matches: `YourNickname.ExtractParamsActivity+prod`

### No Parameters Found
- Verify the Inventor file has User Parameters defined (not just Model Parameters)
- Check that parameters are not suppressed

### JSON Output Empty
- Check Design Automation logs for errors
- Ensure Newtonsoft.Json is available (it's included with Inventor)
