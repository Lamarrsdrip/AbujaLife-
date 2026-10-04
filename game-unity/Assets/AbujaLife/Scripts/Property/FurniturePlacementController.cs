using UnityEngine;
namespace AbujaLife.Property {
 public sealed class FurniturePlacementController:MonoBehaviour {
  public Camera placementCamera; public LayerMask floorMask=-1; public Material validMaterial, invalidMaterial; public float rotateStep=15f; GameObject preview; Renderer[] renderers; bool valid;
  public void Begin(GameObject prefab){Cancel();preview=Instantiate(prefab);renderers=preview.GetComponentsInChildren<Renderer>();SetPreviewLayer(true);}
  public void Rotate(float direction){if(preview)preview.transform.Rotate(Vector3.up,rotateStep*Mathf.Sign(direction));}
  void Update(){if(!preview||!placementCamera)return;var ray=placementCamera.ScreenPointToRay(UnityEngine.Input.mousePosition);if(Physics.Raycast(ray,out var hit,100,floorMask)){preview.transform.position=hit.point;valid=!Physics.CheckBox(preview.transform.position+Vector3.up*.5f,new Vector3(.5f,.5f,.5f),preview.transform.rotation,~floorMask,QueryTriggerInteraction.Ignore);Tint(valid);}}
  public GameObject Commit(){if(!preview||!valid)return null;var placed=preview;preview=null;SetMaterialRestore(placed);return placed;}
  public void Cancel(){if(preview)Destroy(preview);preview=null;}
  void Tint(bool ok){if(renderers==null)return;foreach(var r in renderers)if(r)r.sharedMaterial=ok?validMaterial:invalidMaterial;}
  void SetPreviewLayer(bool on){if(!preview)return;foreach(var c in preview.GetComponentsInChildren<Collider>())c.enabled=!on;}
  static void SetMaterialRestore(GameObject go){foreach(var c in go.GetComponentsInChildren<Collider>())c.enabled=true;}
 }
}
