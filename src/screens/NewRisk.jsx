import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Save, Sparkles, AlertTriangle,
  Check, ChevronRight, Info, RotateCcw, X, Plus, Trash2,
  Loader,
} from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { Button, Badge, Avatar } from '../components/ui';

const STEPS = ['Context', 'Risk & Impact', 'Mitigations', 'Residual Risk', 'Submit'];

function FieldLabel({ num, label, hint, aiTag }) {
  return (
    <div className="flex items-baseline gap-2 mb-1.5">
      <span className="text-xs font-bold text-slate-400 w-5 flex-shrink-0">{num}.</span>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
      {aiTag && (
        <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 font-medium">
          <Sparkles size={11} /> AI suggested edit
        </span>
      )}
    </div>
  );
}

function RiskMatrix({ impact, likelihood }) {
  const cellColor = (i, l) => {
    const v = i * l;
    if (v >= 15) return '#fca5a5';
    if (v >= 9)  return '#fcd34d';
    if (v >= 4)  return '#fef9c3';
    return '#bbf7d0';
  };
  return (
    <div>
      <div className="grid gap-px bg-slate-200 rounded overflow-hidden" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[5,4,3,2,1].map((i) =>
          [1,2,3,4,5].map((l) => {
            const sel = i === impact && l === likelihood;
            return (
              <div key={`${i}-${l}`} className="w-7 h-6 flex items-center justify-center text-xs font-bold transition-transform"
                style={{ background: sel ? '#1d4ed8' : cellColor(i, l), color: sel ? 'white' : '#374151',
                  transform: sel ? 'scale(1.15)' : 'scale(1)', zIndex: sel ? 1 : 0,
                  position: 'relative', borderRadius: sel ? '3px' : undefined }}>
                {sel ? i * l : ''}
              </div>
            );
          })
        )}
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>← Likelihood →</span>
        <span className="font-mono">{impact} × {likelihood} = {impact * likelihood}</span>
      </div>
    </div>
  );
}

export default function NewRisk() {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  const [systems, setSystems] = useState([]);
  const [system, setSystem]   = useState(null);

  const [title, setTitle]             = useState('');
  const [statement, setStatement]     = useState('');
  const [impact, setImpact]           = useState(3);
  const [likelihood, setLikelihood]   = useState(3);
  const [residualI, setResidualI]     = useState(2);
  const [residualL, setResidualL]     = useState(2);
  const [mitigations, setMitigations] = useState([
    { id: 1, text: '', owner: '', due: '', type: 'preventive' },
  ]);
  const [justification, setJustification] = useState('');

  const [aiResult, setAiResult]     = useState(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState(null);
  const [aiDismissed, setAiDismissed] = useState({});

  const [submitting, setSubmitting]   = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [riskId, setRiskId]           = useState(null);

  useEffect(() => {
    api.getSystems()
      .then(rows => { setSystems(rows); setSystem(rows[0] || null); })
      .catch(() => {});
  }, []);

  const inherentScore = impact * likelihood;
  const residualScore = residualI * residualL;
  const levelLabel = (s) => s >= 15 ? 'High' : s >= 9 ? 'Medium' : s >= 4 ? 'Low' : 'Very Low';
  const levelColor  = (s) => s >= 15 ? 'text-red-700 bg-red-50 border-red-200'
                           : s >= 9  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                     : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  async function runAiReview() {
    if (!statement.trim()) { setAiError('Please enter a risk description first.'); return; }
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await api.reviewRisk({
        systemName: system?.name,
        statement,
        impact,
        likelihood,
        residual_impact: residualI,
        residual_likelihood: residualL,
        mitigations: mitigations.filter(m => m.text),
        justification,
      });
      setAiResult(result);
      setAiDismissed({});
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function buildRiskPayload() {
    return {
      title: title.trim(),
      risk_statement: statement,
      owner: currentUser?.name,
      team: currentUser?.team,
      system_name: system?.name,
      impact,
      likelihood,
      residual_impact: residualI,
      residual_likelihood: residualL,
      ai_residual_impact: aiResult?.proposed_residual_impact || null,
      ai_residual_likelihood: aiResult?.proposed_residual_likelihood || null,
      mitigations: mitigations.filter(m => m.text),
      justification,
    };
  }

  async function handleSaveDraft() {
    if (!title.trim()) { alert('Please enter a risk title.'); return; }
    if (!statement.trim()) { alert('Please enter a risk description.'); return; }
    setSavingDraft(true);
    try {
      const created = await api.createRisk(buildRiskPayload());
      navigate(`/risk/${created.id}`);
    } catch (e) {
      alert(`Failed to save draft: ${e.message}`);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) { alert('Please enter a risk title.'); return; }
    if (!statement.trim()) { alert('Please enter a risk description.'); return; }
    setSubmitting(true);
    try {
      const created = await api.createRisk(buildRiskPayload());

      // Submit for review (Draft → Biz Owner). If this step fails, the Draft
      // has already been persisted — navigate to its detail page so the user
      // can retry the transition rather than re-creating a duplicate risk.
      try {
        await api.transition(created.id, {
          action: 'submit',
          comment: 'Submitted for business owner review.',
        });
      } catch (transitionErr) {
        alert(`Draft saved (${created.id}) but submission failed: ${transitionErr.message}. You can resubmit from the risk page.`);
      }

      navigate(`/risk/${created.id}`);
    } catch (e) {
      alert(`Submission failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const flags = aiResult?.flags || [];
  const suggestions = aiResult?.suggestions || [];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ChevronLeft size={16} /> Back
            </Link>
            <div className="w-px h-4 bg-slate-200" />
            <span className="text-sm font-semibold text-slate-800">New Risk Assessment</span>
            <Badge variant="warning" size="xs">Draft</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={runAiReview} disabled={aiLoading}>
              {aiLoading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiLoading ? 'Reviewing…' : 'Review with AI'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={savingDraft || submitting || !currentUser}>
              <Save size={14} /> {savingDraft ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || savingDraft || !currentUser}>
              <Send size={14} /> {submitting ? 'Submitting…' : 'Submit for review'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2.5 text-xs text-slate-400">
          {['1. Draft (you)', '2. System Owner', '3. Concurrent Review', '4. Approved'].map((s, i) => (
            <span key={i} className={`flex items-center gap-1 ${i === 0 ? 'text-blue-700 font-semibold' : ''}`}>
              {i > 0 && <ChevronRight size={11} className="text-slate-300" />}
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          <div className="max-w-2xl space-y-6">
            {/* System context */}
            <section>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Background / Context</div>
              <div className="mb-5">
                <FieldLabel num="1" label="Risk Title" hint="required" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short, descriptive title for this risk…"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-5">
                <FieldLabel num="2" label="System" hint="required" />
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <select
                    value={system?.name || ''}
                    onChange={(e) => setSystem(systems.find(s => s.name === e.target.value) || null)}
                    className="w-full text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  >
                    {systems.map(s => <option key={s.id}>{s.name}</option>)}
                  </select>
                  {system && (
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 flex-wrap">
                      <Avatar initials={(system.owner || '?').split(' ').map(p=>p[0]).join('').slice(0,2)} size="sm" />
                      <div className="text-sm">
                        <span className="font-medium text-slate-800">{system.owner}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-slate-500">{system.team}</span>
                      </div>
                      <div className="flex gap-1.5 ml-auto flex-wrap">
                        <Badge variant={system.criticality === 'Critical' ? 'danger' : system.criticality === 'High' ? 'warning' : 'default'} size="xs">
                          {system.criticality}
                        </Badge>
                        {system.rml && (
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
                            system.rml === 'High'   ? 'bg-red-50 text-red-700 border-red-200' :
                            system.rml === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                      'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            RML: {system.rml}
                          </span>
                        )}
                        {system.internet_facing && <Badge variant="danger" size="xs">● Internet-facing</Badge>}
                        <Badge variant="default" size="xs">{system.sensitivity}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Risk & impact */}
            <section>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Risk & Impact</div>

              <div className="mb-5">
                <FieldLabel num="3" label="Risk Description" hint="cause → event → consequence" aiTag={!!aiResult} />
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  rows={3}
                  placeholder="Because [cause], [actor] could [event], resulting in [consequence]…"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">{statement.split(' ').filter(Boolean).length} words</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5 mb-5">
                <div>
                  <FieldLabel num="4" label="Impact" />
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold text-slate-900">{impact}</span>
                      <span className="text-sm font-medium text-slate-600">
                        {['','Negligible','Minor','Moderate','Major','Catastrophic'][impact]}
                      </span>
                    </div>
                    <input type="range" min={1} max={5} value={impact} onChange={(e) => setImpact(+e.target.value)}
                      className="w-full accent-blue-700 cursor-pointer" />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel num="5" label="Likelihood" />
                  <div className={`bg-white border rounded-xl p-4 shadow-sm ${system?.internet_facing && likelihood < 3 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-2xl font-bold ${system?.internet_facing && likelihood < 3 ? 'text-red-700' : 'text-slate-900'}`}>{likelihood}</span>
                      <span className="text-sm font-medium text-slate-600">
                        {['','Rare','Unlikely','Possible','Likely','Almost Certain'][likelihood]}
                      </span>
                    </div>
                    <input type="range" min={1} max={5} value={likelihood} onChange={(e) => setLikelihood(+e.target.value)}
                      className="w-full accent-blue-700 cursor-pointer" />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                    {system?.internet_facing && likelihood < 3 && (
                      <div className="flex items-start gap-2 mt-3 p-2.5 bg-red-100 rounded-lg text-xs text-red-700">
                        <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                        <span><strong>Policy floor (BP-042):</strong> Internet-facing systems require L ≥ 3.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel num="6" label="Risk Level" hint="auto-calculated" />
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-6">
                  <RiskMatrix impact={impact} likelihood={likelihood} />
                  <div>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-lg font-bold ${levelColor(inherentScore)}`}>
                      {levelLabel(inherentScore)} · {inherentScore}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{impact} (impact) × {likelihood} (likelihood)</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Mitigations */}
            <section>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Mitigations</div>
              <FieldLabel num="7" label="Mitigation Measures" />
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="grid text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 px-4 py-2.5 border-b border-slate-200"
                  style={{ gridTemplateColumns: '1fr 90px 80px 110px 32px' }}>
                  <span>Control</span><span>Owner</span><span>Due</span><span>Type</span><span />
                </div>
                {mitigations.map((m) => (
                  <div key={m.id} className="grid items-center px-4 py-2 border-b border-slate-100 last:border-0"
                    style={{ gridTemplateColumns: '1fr 90px 80px 110px 32px' }}>
                    <input value={m.text} onChange={e => setMitigations(mitigations.map(x => x.id === m.id ? {...x, text: e.target.value} : x))}
                      placeholder="Control description" className="text-sm border-0 focus:outline-none bg-transparent pr-2" />
                    <input value={m.owner} onChange={e => setMitigations(mitigations.map(x => x.id === m.id ? {...x, owner: e.target.value} : x))}
                      placeholder="Owner" className="text-xs border-0 focus:outline-none bg-transparent" />
                    <input value={m.due} onChange={e => setMitigations(mitigations.map(x => x.id === m.id ? {...x, due: e.target.value} : x))}
                      placeholder="Due date" className="text-xs border-0 focus:outline-none bg-transparent" />
                    <select value={m.type} onChange={e => setMitigations(mitigations.map(x => x.id === m.id ? {...x, type: e.target.value} : x))}
                      className="text-xs border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="preventive">Preventive</option>
                      <option value="detective">Detective</option>
                      <option value="corrective">Corrective</option>
                    </select>
                    <button onClick={() => setMitigations(mitigations.filter(x => x.id !== m.id))}
                      className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setMitigations([...mitigations, { id: Date.now(), text: '', owner: '', due: '', type: 'preventive' }])}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-slate-400 hover:text-blue-700 hover:bg-slate-50 transition-colors">
                  <Plus size={14} /> Add mitigation
                </button>
              </div>
            </section>

            {/* Residual risk */}
            <section>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Residual Risk</div>
              <div className="grid sm:grid-cols-2 gap-5 mb-4">
                <div>
                  <FieldLabel num="8" label="Residual Impact" />
                  <input type="range" min={1} max={5} value={residualI} onChange={e => setResidualI(+e.target.value)}
                    className="w-full accent-blue-700 cursor-pointer mt-2" />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    {[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
                <div>
                  <FieldLabel num="9" label="Residual Likelihood" />
                  <input type="range" min={1} max={5} value={residualL} onChange={e => setResidualL(+e.target.value)}
                    className="w-full accent-blue-700 cursor-pointer mt-2" />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    {[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-base font-bold ${levelColor(residualScore)}`}>
                Residual: {levelLabel(residualScore)} · {residualScore}
              </div>
            </section>

            {/* Justification */}
            <section>
              <FieldLabel num="10" label="Justification" hint="Why is this residual level acceptable?" aiTag={!!aiResult} />
              <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={4}
                placeholder="Explain why mitigations reduce risk to an acceptable level…"
                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </section>

            <div className="flex justify-end gap-2 pt-2 pb-8">
              <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft || submitting || !currentUser}>
                <Save size={14} /> {savingDraft ? 'Saving…' : 'Save Draft'}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || savingDraft || !currentUser}>
                <Send size={14} /> {submitting ? 'Submitting…' : 'Submit for review'}
              </Button>
            </div>
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-80 xl:w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 hidden lg:flex">
          <div className="px-5 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <span className="text-sm font-semibold text-slate-800">AI Review</span>
              </div>
              {aiResult && (
                <span className="text-xs text-emerald-600 font-medium">
                  ● {aiResult.confidence}% conf
                </span>
              )}
            </div>
            {aiResult ? (
              <p className="text-xs text-slate-500 mt-1.5">
                {flags.length} flag{flags.length !== 1 ? 's' : ''} · {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5">
                Click "Review with AI" to check your submission against best practices.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <Loader size={24} className="animate-spin text-blue-500" />
                <span className="text-sm">Reviewing against best practices…</span>
              </div>
            )}

            {aiError && (
              <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-xs text-red-700">
                <strong>Review failed:</strong> {aiError}
              </div>
            )}

            {/* ── Residual Risk Assessment (top priority) ── */}
            {!aiLoading && aiResult?.proposed_residual_impact && aiResult?.proposed_residual_likelihood && (() => {
              const aiScore   = aiResult.proposed_residual_impact * aiResult.proposed_residual_likelihood;
              const userScore = residualI * residualL;
              const verdict   = aiResult.residual_assessment?.verdict || (aiScore > userScore + 2 ? 'underestimated' : aiScore < userScore - 2 ? 'overestimated' : 'justified');
              const aiLevel   = aiScore >= 15 ? 'High' : aiScore >= 9 ? 'Medium' : aiScore >= 4 ? 'Low' : 'Very Low';
              const userLevel = userScore >= 15 ? 'High' : userScore >= 9 ? 'Medium' : userScore >= 4 ? 'Low' : 'Very Low';
              const verdictMeta = {
                justified:     { label: 'Justified',      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: '✓' },
                underestimated:{ label: 'Gap — too low',  cls: 'bg-red-50 border-red-200 text-red-700',             icon: '↑' },
                overestimated: { label: 'Conservative',   cls: 'bg-amber-50 border-amber-200 text-amber-700',       icon: '↓' },
              }[verdict] || { label: verdict, cls: 'bg-slate-50 border-slate-200 text-slate-600', icon: '?' };

              return (
                <div className="border border-violet-200 bg-violet-50 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="px-4 pt-3 pb-2 border-b border-violet-200">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-violet-600" />
                      <span className="text-xs font-semibold text-violet-800">AI Residual Risk Assessment</span>
                    </div>
                  </div>

                  {/* Score comparison */}
                  <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-violet-100">
                    <div className="bg-white rounded-lg p-2.5 border border-violet-100">
                      <div className="text-xs text-slate-500 mb-1">Your estimate</div>
                      <div className={`text-sm font-bold ${userScore >= 15 ? 'text-red-700' : userScore >= 9 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {userLevel} · {userScore}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">I:{residualI} × L:{residualL}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-violet-100">
                      <div className="text-xs text-slate-500 mb-1">AI assessment</div>
                      <div className={`text-sm font-bold ${aiScore >= 15 ? 'text-red-700' : aiScore >= 9 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {aiLevel} · {aiScore}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">I:{aiResult.proposed_residual_impact} × L:{aiResult.proposed_residual_likelihood}</div>
                    </div>
                  </div>

                  {/* Verdict */}
                  <div className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border mb-2 ${verdictMeta.cls}`}>
                      {verdictMeta.icon} {verdictMeta.label}
                    </span>
                    {aiResult.residual_assessment?.reasoning && (
                      <p className="text-xs text-slate-700 leading-relaxed">{aiResult.residual_assessment.reasoning}</p>
                    )}
                  </div>

                  {/* Apply AI values */}
                  {verdict !== 'justified' && (
                    <div className="px-4 pb-3">
                      <Button size="xs" variant="secondary" onClick={() => {
                        setResidualI(aiResult.proposed_residual_impact);
                        setResidualL(aiResult.proposed_residual_likelihood);
                      }}>
                        <Check size={11} /> Apply AI residual to my form
                      </Button>
                    </div>
                  )}

                  {/* Additional mitigations (only when underestimated) */}
                  {verdict === 'underestimated' && aiResult.additional_mitigations?.length > 0 && (
                    <div className="border-t border-violet-200 px-4 py-3 bg-red-50">
                      <div className="text-xs font-semibold text-red-800 mb-2.5">
                        Suggested additional controls to justify your claimed residual:
                      </div>
                      <div className="space-y-2.5">
                        {aiResult.additional_mitigations.map((m, i) => (
                          <div key={i} className="bg-white rounded-lg border border-red-200 p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-800 leading-snug flex-1">{m.text}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0 capitalize">{m.type}</span>
                            </div>
                            {m.rationale && (
                              <p className="text-xs text-slate-500 italic mb-2">{m.rationale}</p>
                            )}
                            <Button size="xs" variant="secondary" onClick={() => {
                              setMitigations(prev => [...prev, {
                                id: Date.now() + i,
                                text: m.text,
                                owner: '',
                                due: '',
                                type: m.type || 'preventive',
                              }]);
                            }}>
                              <Plus size={11} /> Add to my list
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Policy flags ── */}
            {!aiLoading && flags.map((flag, i) => (
              <div key={i} className={`border rounded-xl p-4 ${flag.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className={flag.severity === 'error' ? 'text-red-600' : 'text-amber-600'} />
                    <span className={`text-xs font-semibold ${flag.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                      {flag.type === 'policy' ? 'Policy' : 'Quality'} · {flag.field}
                    </span>
                  </div>
                  {flag.bp && <Badge variant={flag.severity === 'error' ? 'danger' : 'warning'} size="xs">{flag.bp}</Badge>}
                </div>
                <p className={`text-xs leading-relaxed ${flag.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                  {flag.message}
                </p>
              </div>
            ))}

            {/* ── Improvement suggestions ── */}
            {!aiLoading && suggestions.map((s, i) => {
              const key = `sug-${i}`;
              if (aiDismissed[key]) return null;
              return (
                <div key={i} className="border border-slate-200 bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700">{s.field}</span>
                    {s.bp && <Badge variant="info" size="xs">{s.bp}</Badge>}
                  </div>
                  {s.original && s.improved && (
                    <div className="text-xs space-y-2 mb-3">
                      <div className="line-through text-slate-400 leading-relaxed bg-red-50 px-2 py-1.5 rounded">{s.original}</div>
                      <div className="text-emerald-700 leading-relaxed bg-emerald-50 px-2 py-1.5 rounded">{s.improved}</div>
                    </div>
                  )}
                  {s.note && <p className="text-xs text-slate-400 italic mb-3">{s.note}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="xs" onClick={() => setAiDismissed({...aiDismissed, [key]: true})}>
                      <X size={11} /> Dismiss
                    </Button>
                    {s.improved && (
                      <Button size="xs" onClick={() => {
                        if (s.field?.toLowerCase().includes('statement')) setStatement(s.improved);
                        else if (s.field?.toLowerCase().includes('justification')) setJustification(s.improved);
                        setAiDismissed({...aiDismissed, [key]: true});
                      }}>
                        <Check size={11} /> Accept
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ── Rewritten statement ── */}
            {!aiLoading && aiResult?.rewritten_statement && !aiDismissed['rewrite'] && (
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-800 mb-2">Suggested rewrite (BP-007)</div>
                <p className="text-xs text-blue-800 leading-relaxed mb-3">{aiResult.rewritten_statement}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="xs" onClick={() => setAiDismissed({...aiDismissed, rewrite: true})}>
                    <X size={11} /> Dismiss
                  </Button>
                  <Button size="xs" onClick={() => { setStatement(aiResult.rewritten_statement); setAiDismissed({...aiDismissed, rewrite: true}); }}>
                    <Check size={11} /> Use this
                  </Button>
                </div>
              </div>
            )}

            {!aiLoading && !aiResult && !aiError && (
              <div className="text-center py-8">
                <Sparkles size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  AI review evaluates your residual risk estimate against your mitigations, checks policy compliance, and proposes additional controls if the gap is too large.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200">
            <Button variant="secondary" size="sm" className="w-full" onClick={runAiReview} disabled={aiLoading}>
              {aiLoading ? <Loader size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              {aiLoading ? 'Reviewing…' : aiResult ? 'Re-run review' : 'Run AI review'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
