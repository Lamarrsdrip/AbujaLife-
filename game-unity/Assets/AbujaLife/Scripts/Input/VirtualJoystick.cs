using UnityEngine;
using UnityEngine.EventSystems;
namespace AbujaLife.Input {
  public sealed class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler {
    public RectTransform background; public RectTransform knob; [Range(.2f,1f)] public float deadZone=.08f;
    public Vector2 Value { get; private set; }
    public void OnPointerDown(PointerEventData e)=>OnDrag(e);
    public void OnDrag(PointerEventData e){ if(RectTransformUtility.ScreenPointToLocalPointInRectangle(background,e.position,e.pressEventCamera,out var p)){var r=background.rect.size*.5f; var n=new Vector2(p.x/r.x,p.y/r.y); Value=n.magnitude<deadZone?Vector2.zero:Vector2.ClampMagnitude(n,1); knob.anchoredPosition=new Vector2(Value.x*r.x*.55f,Value.y*r.y*.55f);} }
    public void OnPointerUp(PointerEventData e){Value=Vector2.zero;knob.anchoredPosition=Vector2.zero;}
  }
}
