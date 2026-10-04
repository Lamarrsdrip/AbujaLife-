using UnityEngine; using UnityEngine.EventSystems;
namespace AbujaLife.Input { public sealed class TouchLookArea:MonoBehaviour,IDragHandler { public PlayerInputRouter router; public float scale=.65f; public void OnDrag(PointerEventData e)=>router.AddTouchLook(e.delta*scale); } }
