# AppBundles Folder

Place your Design Automation AppBundle ZIP files here.

## Supported Bundles

| Bundle Name | Engine | Description |
|------------|--------|-------------|
| `UpdateIPTParam.zip` | Inventor | Modify Inventor IPT parameters |
| `UpdateDWGParam.zip` | AutoCAD | Modify AutoCAD DWG parameters |
| `UpdateRVTParam.zip` | Revit | Modify Revit RVT parameters |

## Creating Custom Bundles

1. **For Inventor (iLogic)**:
   - Create an iLogic add-in that reads `params.json` and modifies parameters
   - Package as a `.bundle` folder
   - ZIP the folder as `YourBundleName.zip`

2. **For AutoCAD**:
   - Create a .NET plugin that processes parameters
   - Package as a `.bundle` folder
   - ZIP the folder as `YourBundleName.zip`

## Bundle Structure

```
YourBundle.zip
└── YourBundle.bundle/
    ├── PackageContents.xml
    └── Contents/
        └── YourPlugin.dll (or .iLogicVb)
```

## Resources

- [APS Design Automation Documentation](https://aps.autodesk.com/en/docs/design-automation/v3/)
- [AppBundle Requirements](https://aps.autodesk.com/en/docs/design-automation/v3/developers_guide/basics/)
