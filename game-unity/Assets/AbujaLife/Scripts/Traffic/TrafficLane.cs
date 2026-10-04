using UnityEngine;
namespace AbujaLife.Traffic { public sealed class TrafficLane:MonoBehaviour { public Transform[] points; public float speedLimitKph=50; public bool oneWay=true; public Vector3 Point(int i)=>points[i%points.Length].position; } }
