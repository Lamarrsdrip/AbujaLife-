using UnityEngine;
using AbujaLife.Player;
using AbujaLife.CameraSystem;
namespace AbujaLife.Input {
  public sealed class PlayerInputRouter : MonoBehaviour {
    public ThirdPersonMotor motor; public OrbitCamera orbitCamera; public VirtualJoystick moveStick; public bool allowDesktopFallback=true; public float mouseLookScale=6f; bool runHeld;
    public void SetRun(bool held)=>runHeld=held;
    void Update(){
      Vector2 move=moveStick!=null?moveStick.Value:Vector2.zero;
#if UNITY_EDITOR || UNITY_STANDALONE || UNITY_WEBGL
      if(allowDesktopFallback && move.sqrMagnitude<.001f) move=new Vector2(UnityEngine.Input.GetAxisRaw("Horizontal"),UnityEngine.Input.GetAxisRaw("Vertical"));
      if(allowDesktopFallback && UnityEngine.Input.GetMouseButton(1)) orbitCamera.AddLook(new Vector2(UnityEngine.Input.GetAxis("Mouse X"),UnityEngine.Input.GetAxis("Mouse Y"))*mouseLookScale);
      bool run=runHeld || UnityEngine.Input.GetKey(KeyCode.LeftShift);
#else
      bool run=runHeld;
#endif
      motor.SetInput(move,run);
    }
    public void AddTouchLook(Vector2 delta)=>orbitCamera.AddLook(delta);
  }
}
