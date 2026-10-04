#if UNITY_EDITOR
using System.Linq; using UnityEditor; using UnityEngine;
namespace AbujaLife.EditorTools { public static class AbujaProjectReadiness {
 [MenuItem("AbujaLife/Validate/Production Readiness")]
 public static void Validate(){int errors=0;string[] required={"Assets/AbujaLife/Scripts","Assets/AbujaLife/Editor"};foreach(var p in required)if(!AssetDatabase.IsValidFolder(p)){Debug.LogError("Missing "+p);errors++;}var scenes=AssetDatabase.FindAssets("t:Scene");if(scenes.Length==0)Debug.LogWarning("No scene generated yet. Run AbujaLife > Build > Open World Vertical Slice.");var dup=AssetDatabase.FindAssets("t:Script").Select(AssetDatabase.GUIDToAssetPath).GroupBy(System.IO.Path.GetFileName).Where(g=>g.Count()>1).ToArray();foreach(var d in dup)Debug.LogWarning("Duplicate script filename: "+d.Key);Debug.Log(errors==0?"AbujaLife project structure validation passed.":$"AbujaLife validation found {errors} blocking issue(s)."); }
} }
#endif
