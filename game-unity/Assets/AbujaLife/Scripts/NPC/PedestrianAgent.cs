using UnityEngine; using UnityEngine.AI;
namespace AbujaLife.NPC {
 [RequireComponent(typeof(NavMeshAgent))] public sealed class PedestrianAgent:MonoBehaviour { public Transform[] anchors; public Vector2 waitRange=new(3,14); NavMeshAgent agent; float wait; int target; void Awake()=>agent=GetComponent<NavMeshAgent>(); void Start()=>Pick(); void Update(){if(agent.pathPending)return;if(agent.remainingDistance<=agent.stoppingDistance+.2f){wait-=Time.deltaTime;if(wait<=0)Pick();}} void Pick(){if(anchors==null||anchors.Length==0)return;target=Random.Range(0,anchors.Length);agent.SetDestination(anchors[target].position);wait=Random.Range(waitRange.x,waitRange.y);} }
}
