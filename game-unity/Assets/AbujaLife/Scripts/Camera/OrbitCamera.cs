using UnityEngine;
namespace AbujaLife.CameraSystem {
  public sealed class OrbitCamera : MonoBehaviour {
    public Transform target; public Vector3 targetOffset = new Vector3(0, 1.55f, 0); public float distance=4.2f; public float sensitivity=.11f; public float minPitch=-15, maxPitch=65; public LayerMask collisionMask=-1;
    float yaw, pitch=15;
    public void AddLook(Vector2 delta){ yaw += delta.x*sensitivity; pitch=Mathf.Clamp(pitch-delta.y*sensitivity,minPitch,maxPitch); }
    void LateUpdate(){ if(!target)return; var pivot=target.position+targetOffset; var rot=Quaternion.Euler(pitch,yaw,0); var desired=pivot-rot*Vector3.forward*distance; if(Physics.Linecast(pivot,desired,out var hit,collisionMask,QueryTriggerInteraction.Ignore)) desired=hit.point+hit.normal*.12f; transform.SetPositionAndRotation(desired,rot); }
  }
}
