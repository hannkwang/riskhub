import { useState, useEffect } from 'react';
import { Clock, Save, CalendarClock } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { Button, Card, PageHeader, Divider } from '../components/ui';

const STAGE_META = {
  'Draft':             { label: 'Draft',             desc: 'Time for the risk raiser to complete and submit the assessment.' },
  'System Owner':      { label: 'System Owner',      desc: 'Time for the Business / System Owner to review and approve.' },
  'Concurrent Review': { label: 'Concurrent Review', desc: 'Time for Cyber Security, TGA, and GRC Co-Chair to complete their reviews.' },
};

export default function SLA() {
  const { currentUser } = useUser();
  const canEdit = currentUser?.role === 'tech_governance';

  const [settings, setSettings]       = useState([]);
  const [drafts, setDrafts]           = useState({});
  const [saving, setSaving]           = useState({});
  const [errors, setErrors]           = useState({});

  const [reviewMonths, setReviewMonths]       = useState('');
  const [reviewDraft, setReviewDraft]         = useState('');
  const [reviewSaving, setReviewSaving]       = useState(false);
  const [reviewError, setReviewError]         = useState(null);

  useEffect(() => {
    Promise.all([api.getSla(), api.getPortalSettings()]).then(([sla, portal]) => {
      setSettings(sla);
      const d = {};
      sla.forEach(r => { d[r.stage] = String(r.days); });
      setDrafts(d);

      const rp = portal.find(p => p.key === 'review_period_months');
      if (rp) { setReviewMonths(rp.value); setReviewDraft(String(rp.value)); }
    });
  }, []);

  async function saveSla(stage) {
    const days = parseInt(drafts[stage], 10);
    if (!Number.isInteger(days) || days < 1) {
      setErrors(e => ({ ...e, [stage]: 'Must be a positive number' }));
      return;
    }
    setErrors(e => ({ ...e, [stage]: null }));
    setSaving(s => ({ ...s, [stage]: true }));
    try {
      const updated = await api.updateSla(stage, days);
      setSettings(prev => prev.map(r => r.stage === stage ? { ...r, days: updated.days } : r));
    } catch (err) {
      setErrors(e => ({ ...e, [stage]: err.message }));
    } finally {
      setSaving(s => ({ ...s, [stage]: false }));
    }
  }

  async function saveReviewPeriod() {
    const val = parseInt(reviewDraft, 10);
    if (!Number.isInteger(val) || val < 1 || val > 120) {
      setReviewError('Must be between 1 and 120 months');
      return;
    }
    setReviewError(null);
    setReviewSaving(true);
    try {
      const updated = await api.updatePortalSetting('review_period_months', val);
      setReviewMonths(updated.value);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSaving(false);
    }
  }

  const reviewIsDirty = parseInt(reviewDraft, 10) !== reviewMonths;

  return (
    <>
      <PageHeader
        title="SLA & Expiry Settings"
        subtitle="Stage deadlines and risk acceptance expiry — managed by Tech Governance Assurance"
      />

      <div className="max-w-2xl space-y-8">

        {/* Review period */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Risk Acceptance Expiry</div>
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarClock size={15} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-800">Default review period</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Expiry is set to the last day of the same calendar month, this many months after the approval date.
                  e.g. approved 23 Jan 2025 with 12 months → expires 31 Jan 2026.
                </p>
                {reviewError && <p className="text-xs text-red-600 mt-1">{reviewError}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min={1} max={120}
                    value={reviewDraft}
                    onChange={e => setReviewDraft(e.target.value)}
                    disabled={!canEdit}
                    className="w-16 text-sm text-center border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <span className="text-sm text-slate-500">months</span>
                </div>
                {canEdit && (
                  <Button size="sm" disabled={!reviewIsDirty || reviewSaving} onClick={saveReviewPeriod}>
                    <Save size={13} /> {reviewSaving ? 'Saving…' : 'Save'}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* SLA deadlines */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Workflow Stage SLA</div>
          <div className="space-y-4">
            {settings.map(({ stage, days }) => {
              const meta = STAGE_META[stage] || { label: stage, desc: '' };
              const isDirty = drafts[stage] !== undefined && parseInt(drafts[stage], 10) !== days;
              const isReadOnly = stage === 'Draft' || !canEdit;

              return (
                <Card key={stage}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={15} className="text-slate-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                        {stage === 'Draft' && (
                          <span className="text-xs text-slate-400 italic">(not configurable)</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{meta.desc}</p>
                      {errors[stage] && <p className="text-xs text-red-600 mt-1">{errors[stage]}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={1} max={365}
                          value={drafts[stage] ?? days}
                          onChange={e => setDrafts(d => ({ ...d, [stage]: e.target.value }))}
                          disabled={isReadOnly}
                          className="w-16 text-sm text-center border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        <span className="text-sm text-slate-500">days</span>
                      </div>
                      {canEdit && !isReadOnly && (
                        <Button size="sm" disabled={!isDirty || saving[stage]} onClick={() => saveSla(stage)}>
                          <Save size={13} /> {saving[stage] ? 'Saving…' : 'Save'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {!canEdit && (
          <p className="text-xs text-slate-400 text-center pt-2">
            These settings can only be updated by the Tech Governance Assurance team.
          </p>
        )}
      </div>
    </>
  );
}
