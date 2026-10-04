using UnityEngine;
namespace AbujaLife.World { public sealed class WorldChunkAnchor:MonoBehaviour { public string districtId; public Bounds worldBounds = new Bounds(Vector3.zero, new Vector3(500, 200, 500)); void OnDrawGizmosSelected(){Gizmos.matrix=transform.localToWorldMatrix;Gizmos.DrawWireCube(worldBounds.center,worldBounds.size);} } }
