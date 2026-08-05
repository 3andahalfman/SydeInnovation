# UpdateModel Bundle

Combined 3D model regeneration + 2D drawing export bundle for APS Design Automation.

## What it does

1. Opens the input IPT/IAM file (via Inventor engine command line)
2. Reads `params.json` and applies parameter values to the model
3. Regenerates the model geometry (`doc.Update()`)
4. Saves the updated model as `output.ipt`
5. Opens the associated Inventor Drawing (`input.idw`) which references the model
6. Updates the drawing views (picks up geometry changes)
7. Exports the drawing as `output.dwg` using Inventor's DWG translator

## Activity Parameters

| Parameter | Direction | localName | Description |
|-----------|-----------|-----------|-------------|
| `inputFile` | GET | `input.ipt` | Source Inventor part/assembly |
| `inputDwg` | GET | `input.idw` | Source Inventor Drawing |
| `inputJson` | GET | `params.json` | JSON with parameter values |
| `outputFile` | PUT | `output.ipt` | Regenerated model |
| `outputDwg` | PUT | `output.dwg` | Exported DWG drawing |

## params.json Format

```json
{
  "Width": "150 mm",
  "Height": "200 mm",
  "Depth": "50 mm",
  "Material": "Steel"
}
```

Numeric parameters use Inventor expressions (value + unit). Text/boolean parameters use plain values.

## Engine

`Autodesk.Inventor+2024`

## Packaging

The bundle is zipped as `UpdateModelBundle.zip` and registered with APS via the `/api/setup/update-model-bundle` endpoint.
