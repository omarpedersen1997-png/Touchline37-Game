using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
static class SyntaxCheck
{
    static int Main()
    {
        var files=Directory.GetFiles("unity/TouchlineUnity/Assets/Touchline","*.cs",SearchOption.AllDirectories);int errors=0;
        foreach(var file in files)
        {
            var tree=CSharpSyntaxTree.ParseText(File.ReadAllText(file),new CSharpParseOptions(LanguageVersion.CSharp9,preprocessorSymbols:new[]{"UNITY_EDITOR","UNITY_INCLUDE_TESTS"}),file);
            foreach(var issue in tree.GetDiagnostics().Where(d=>d.Severity==DiagnosticSeverity.Error)){errors++;Console.WriteLine(issue);}
        }
        File.WriteAllText("unity/Evidence/syntax-check.json",JsonSerializer.Serialize(new{files=files.Length,errors,scope="C# 9 syntax ONLY. This does not validate Unity APIs, packages, rendering or Android.",unityEditorExecuted=false},new JsonSerializerOptions{WriteIndented=true}));
        Console.WriteLine("C# syntax: "+files.Length+" files, "+errors+" errors. Unity API compilation NOT executed.");return errors==0?0:1;
    }
}
