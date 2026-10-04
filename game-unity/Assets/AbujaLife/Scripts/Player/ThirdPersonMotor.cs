using UnityEngine;
namespace AbujaLife.Player {
  [RequireComponent(typeof(CharacterController))]
  public sealed class ThirdPersonMotor : MonoBehaviour {
    public Transform cameraTransform;
    public float walkSpeed = 3.2f;
    public float runSpeed = 6.2f;
    public float acceleration = 14f;
    public float rotationSharpness = 14f;
    public float gravity = -24f;
    CharacterController _cc; Vector3 _velocity; float _speed;
    Vector2 _move; bool _run;
    void Awake() => _cc = GetComponent<CharacterController>();
    public void SetInput(Vector2 move, bool run) { _move = Vector2.ClampMagnitude(move, 1f); _run = run; }
    void Update() {
      var camF = Vector3.ProjectOnPlane(cameraTransform.forward, Vector3.up).normalized;
      var camR = Vector3.ProjectOnPlane(cameraTransform.right, Vector3.up).normalized;
      var desired = camF * _move.y + camR * _move.x;
      var targetSpeed = (_run ? runSpeed : walkSpeed) * Mathf.Clamp01(desired.magnitude);
      _speed = Mathf.MoveTowards(_speed, targetSpeed, acceleration * Time.deltaTime);
      if (desired.sqrMagnitude > .02f) transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(desired), 1f - Mathf.Exp(-rotationSharpness * Time.deltaTime));
      if (_cc.isGrounded && _velocity.y < 0) _velocity.y = -2f;
      _velocity.y += gravity * Time.deltaTime;
      _cc.Move((transform.forward * _speed + Vector3.up * _velocity.y) * Time.deltaTime);
    }
  }
}
