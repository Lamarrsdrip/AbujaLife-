using UnityEngine;
namespace AbujaLife.Vehicles {
 [RequireComponent(typeof(Rigidbody))]
 public sealed class VehicleController : MonoBehaviour {
   public WheelCollider frontLeft,frontRight,rearLeft,rearRight; public Transform frontLeftMesh,frontRightMesh,rearLeftMesh,rearRightMesh; public float maxMotorTorque=1650; public float maxBrakeTorque=3800; public float maxSteerAngle=34; public AnimationCurve steerBySpeed=AnimationCurve.Linear(0,1,120,.32f); public float downforce=70;
   Rigidbody _rb; float throttle,brake,steer;
   void Awake(){_rb=GetComponent<Rigidbody>();_rb.centerOfMass+=Vector3.down*.35f;}
   public void SetInput(float steerInput,float throttleInput,float brakeInput){steer=Mathf.Clamp(steerInput,-1,1);throttle=Mathf.Clamp(throttleInput,-1,1);brake=Mathf.Clamp01(brakeInput);}
   void FixedUpdate(){float kph=_rb.linearVelocity.magnitude*3.6f;float angle=maxSteerAngle*steer*steerBySpeed.Evaluate(kph);frontLeft.steerAngle=angle;frontRight.steerAngle=angle;rearLeft.motorTorque=throttle*maxMotorTorque;rearRight.motorTorque=throttle*maxMotorTorque;float bt=brake*maxBrakeTorque;foreach(var w in new[]{frontLeft,frontRight,rearLeft,rearRight})w.brakeTorque=bt;_rb.AddForce(-transform.up*downforce*_rb.linearVelocity.magnitude);Sync(frontLeft,frontLeftMesh);Sync(frontRight,frontRightMesh);Sync(rearLeft,rearLeftMesh);Sync(rearRight,rearRightMesh);}
   static void Sync(WheelCollider w,Transform mesh){if(!w||!mesh)return;w.GetWorldPose(out var p,out var q);mesh.SetPositionAndRotation(p,q);}
 }
}
