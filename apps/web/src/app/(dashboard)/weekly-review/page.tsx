// apps/web/src/app/(dashboard)/weekly-review/page.tsx

"use client";

import { useState } from "react";
import { generateExportForGemini, importGeminiReview } from "@/app/actions/weekly-review";
import { Clipboard, Check, ArrowRight, Brain, AlertTriangle, ListChecks } from "lucide-react";

export default function WeeklyReviewPage() {
  const [step, setStep] = useState<"export" | "import">("export");
  const [prompt, setPrompt] = useState("");
  const [importing, setImporting] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [result, setResult] = useState<{ success: boolean; workoutsCreated: number } | null>(null);
  
  const handleExport = async () => {
    try {
      const { prompt } = await generateExportForGemini();
      setPrompt(prompt);
      await navigator.clipboard.writeText(prompt);
      setStep("import");
    } catch (e) {
      alert(`Chyba při exportu: ${e instanceof Error ? e.message : 'Neznámá chyba'}`);
    }
  };
  
  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await importGeminiReview(importJson);
      setResult({ success: true, workoutsCreated: res.workoutsCreated });
      setStep("export"); // Reset or show success
      setImportJson("");
    } catch (e) {
      alert(`Chyba při importu: ${e instanceof Error ? e.message : 'Neznámá chyba'}`);
    } finally {
      setImporting(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Týdenní Coaching Session
          </h1>
          <p className="text-gray-400 mt-2">Analyzuj svůj pokrok a naplánuj další týden s Gemini Pro.</p>
        </div>
        <div className="bg-blue-500/10 p-3 rounded-full">
          <Brain className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-400 animate-in fade-in slide-in-from-top-2">
          <Check className="w-5 h-5" />
          <span>Plán byl úspěšně aplikován! Vytvořeno {result.workoutsCreated} tréninků.</span>
          <button onClick={() => setResult(null)} className="ml-auto text-sm underline opacity-50 hover:opacity-100 italic">Zavřít</button>
        </div>
      )}
      
      {/* Progress Steps */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${step === "export" ? "bg-blue-600/20 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "bg-card border-white/5 opacity-50"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === "export" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"}`}>1</div>
            <div>
              <p className="font-semibold">Export do Gemini</p>
              <p className="text-xs text-blue-400/70">Zkopíruj data a prompt</p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl border transition-all ${step === "import" ? "bg-emerald-600/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]" : "bg-card border-white/5 opacity-50"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === "import" ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"}`}>2</div>
            <div>
              <p className="font-semibold">Import plánu</p>
              <p className="text-xs text-emerald-400/70">Vlož JSON odpověď</p>
            </div>
          </div>
        </div>
      </div>
      
      {step === "export" && (
        <div className="bg-card border border-white/5 rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Krok 1: Vygeneruj Brain Dump</h2>
            <p className="text-gray-400 leading-relaxed">
              Tento proces stáhne tvých posledních 14 dní života (spánek, HRV, Garmin data, kalendář) 
              a připraví gigantický prompt pro Gemini Pro. Tento "hybridní" model ti zajistí nejvyšší kvalitu tréninku.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 py-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex gap-3 text-sm">
              <ListChecks className="w-5 h-5 text-blue-400 shrink-0" />
              <span>Zahrnuje spánek, únavu, zranění i kalendář pro příští dny.</span>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex gap-3 text-sm">
              <Brain className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Optimalizováno pro model Gemini 1.5 Pro (Google AI Studio).</span>
            </div>
          </div>

          <button 
            onClick={handleExport}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20"
          >
            <Clipboard className="w-5 h-5" />
            Vytvořit & kopírovat prompt
          </button>
          
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200/80">
              Po kliknutí přejdi na <a href="https://aistudio.google.com/" target="_blank" className="underline font-bold text-yellow-500">Google AI Studio</a>, vlož prompt a počkej na JSON odpověď. Pak se vrať sem pro import.
            </div>
          </div>
        </div>
      )}
      
      {step === "import" && (
        <div className="bg-card border border-white/5 rounded-2xl p-8 space-y-6 appearance-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <ArrowRight className="w-5 h-5" />
            <h2 className="text-xl font-semibold text-white">Vlož odpověď z Gemini</h2>
          </div>
          
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Sem vlož celý JSON, který ti vygenerovalo Gemini..."
            className="w-full min-h-[400px] bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-gray-700"
          />
          
          <div className="flex gap-4">
            <button 
              onClick={() => setStep("export")}
              className="px-6 py-4 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              ← Zpět
            </button>
            <button 
              onClick={handleImport} 
              disabled={!importJson || importing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/20"
            >
              {importing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importuji plán...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Aplikovat tréninkový plán
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
