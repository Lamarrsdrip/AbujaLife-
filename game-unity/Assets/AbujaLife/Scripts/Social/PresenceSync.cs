using System; using System.Collections; using UnityEngine; using AbujaLife.Networking;
namespace AbujaLife.Social {
 [Serializable] sealed class Vec3Dto { public float x,y,z; }
 [Serializable] sealed class PresenceRequest { public string districtId; public Vec3Dto position; }
 public sealed class PresenceSync:MonoBehaviour { public ApiClient api; public PlayerSession session; public Transform player; public float intervalSeconds=2f; public string districtId="wuse2"; Coroutine loop;
  void OnEnable(){loop=StartCoroutine(Loop());} void OnDisable(){if(loop!=null)StopCoroutine(loop);} IEnumerator Loop(){var wait=new WaitForSeconds(intervalSeconds);while(true){if(session?.State!=null&&player){var p=player.position;var body=JsonUtility.ToJson(new PresenceRequest{districtId=districtId,position=new Vec3Dto{x=p.x,y=p.y,z=p.z}});yield return api.Post($"/v1/players/{session.State.playerId}/presence",body,_=>{},e=>Debug.LogWarning(e));}yield return wait;}}
 }
}
