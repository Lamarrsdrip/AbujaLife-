using System; using UnityEngine;
namespace AbujaLife.World {
 [Serializable] public sealed class DistrictDefinition { public string id; public string displayName; public string[] sceneNames; public Vector3 anchor; public float loadRadius=900; public float unloadRadius=1250; }
 [CreateAssetMenu(menuName="AbujaLife/World/District Catalog")] public sealed class DistrictCatalog : ScriptableObject { public DistrictDefinition[] districts; }
}
