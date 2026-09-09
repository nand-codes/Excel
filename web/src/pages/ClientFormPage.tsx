import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { IconAlert, IconCheck, IconRefresh } from '@/components/icons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Checkbox, Field, TextArea, TextInput } from '@/components/ui/Field';
import { EmptyState, LoadingPanel } from '@/components/ui/Misc';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { FieldErrors } from '@/lib/api';
import { todayYmd } from '@/lib/format';
import { useClients, useReplaceCachedClient, useSaveClient } from '@/lib/queries';
import { BLOOD_GROUPS, LEGACY_LICENCE_OPTIONS, LICENCE_OPTIONS } from '@/lib/reference';
import type { Client, ClientInput } from '@/lib/types';
import { emptyClientForm, validateClientForm } from '@/lib/validation';
import type { ClientFormValues } from '@/lib/validation';
import { deliverWhatsApp, registrationMessage, reserveWhatsAppTab } from '@/lib/whatsapp';

const BLOOD_OPTIONS = BLOOD_GROUPS.map((group) => ({ value: group, label: group }));

function toFormValues(client: Client): ClientFormValues {
  return {
    name: client.name,
    guardianName: client.guardianName ?? '',
    applicationNumber: client.applicationNumber ?? '',
    phone: client.phone,
    alternatePhone: client.alternatePhone ?? '',
    dob: client.dob,
    bloodGroup: client.bloodGroup,
    licenceType: client.licenceType,
    address: client.address,
  };
}

function toPayload(values: ClientFormValues, id?: string): ClientInput {
  return {
    id,
    name: values.name.trim(),
    phone: values.phone.trim(),
    alternatePhone: values.alternatePhone.trim() || null,
    applicationNumber: values.applicationNumber.trim() || null,
    guardianName: values.guardianName.trim() || null,
    dob: values.dob,
    bloodGroup: values.bloodGroup,
    licenceType: values.licenceType,
    address: values.address.trim(),
  };
}

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const clients = useClients();
  const saveClient = useSaveClient();
  const replaceCachedClient = useReplaceCachedClient();

  const existing = useMemo(
    () => (id ? clients.data?.find((entry) => entry.id === id) ?? null : null),
    [clients.data, id]
  );

  const [values, setValues] = useState<ClientFormValues>(emptyClientForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sendWelcome, setSendWelcome] = useState(true);
  /** The version this edit is based on; the server rejects writes against an older one. */
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
  /** Set when the server refuses the write: someone else saved first, or deleted the record. */
  const [conflict, setConflict] = useState<
    { kind: 'stale'; client: Client } | { kind: 'deleted' } | null
  >(null);

  const isEdit = Boolean(id);

  useEffect(() => {
    if (!isEdit) {
      setValues(emptyClientForm);
      setBaseUpdatedAt(null);
      setErrors({});
      setConflict(null);
      return;
    }
    if (!existing) return;

    setValues(toFormValues(existing));
    setBaseUpdatedAt(existing.updatedAt);
    setErrors({});
  }, [isEdit, existing]);

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function submit(event: FormEvent, overrideUpdatedAt?: string | null) {
    event.preventDefault();

    const found = validateClientForm(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    const expected = overrideUpdatedAt !== undefined ? overrideUpdatedAt : baseUpdatedAt;
    // Reserved during the click, before any await, or the browser blocks it.
    const tab = !isEdit && sendWelcome ? reserveWhatsAppTab() : null;

    saveClient.mutate(
      { client: toPayload(values, id), expectedUpdatedAt: expected },
      {
        onSuccess: ({ client }) => {
          setConflict(null);
          toast(isEdit ? 'Client updated successfully.' : 'Client added successfully.', 'success');

          if (tab) {
            const result = deliverWhatsApp(tab, client.phone, registrationMessage(client));
            if (result.ok) toast('Opening WhatsApp — press Send to deliver.', 'info');
            else toast(result.error ?? 'Could not open WhatsApp.', 'error');
          }

          window.setTimeout(() => navigate('/clients'), 400);
        },
        onError: (error) => {
          tab?.close();

          if (error instanceof ApiError && error.isConflict) {
            if (error.current) {
              setConflict({ kind: 'stale', client: error.current });
              replaceCachedClient(error.current);
              toast('Another user changed this client while you were editing.', 'error');
            } else {
              setConflict({ kind: 'deleted' });
              toast('Another user deleted this client.', 'error');
            }
            return;
          }

          if (error instanceof ApiError && error.fields) {
            setErrors(error.fields);
            toast('Please check the highlighted fields.', 'error');
            return;
          }

          toast(
            error instanceof ApiError ? error.message : 'Could not save this client.',
            'error'
          );
        },
      }
    );
  }

  if (isEdit && clients.isPending) return <LoadingPanel label="Loading client…" />;

  // While a conflict banner is up the record may already be gone from the list; the
  // form stays put so the user does not lose what they typed.
  if (isEdit && !existing && !conflict) {
    return (
      <Card>
        <EmptyState
          title="Client not found"
          hint="This client may have been deleted by another user."
          action={
            <Button size="sm" onClick={() => navigate('/clients')}>
              Back to clients
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[880px] space-y-5">
      <PageHeader
        title={isEdit ? 'Edit client' : 'Add client'}
        subtitle={
          isEdit
            ? `Registered ${new Date(existing?.createdAt ?? Date.now()).toLocaleDateString('en-IN')}`
            : 'Enter the learner’s details to add them to the register'
        }
      />

      <Card>
        <CardBody className="pt-5">
          {conflict?.kind === 'stale' ? (
            <div className="border-sys-red/40 bg-sys-red/8 rounded-card mb-5 border p-4">
              <div className="text-sys-red flex items-center gap-2 text-[13.5px] font-bold">
                <IconAlert size={16} />
                Someone else edited this client
              </div>
              <p className="text-ink-soft mt-1.5 text-[12.5px] leading-relaxed">
                Their saved version has the name <strong>{conflict.client.name}</strong> and phone{' '}
                <strong>{conflict.client.phone}</strong>. Load their version to start from it, or
                keep your changes and overwrite theirs.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setValues(toFormValues(conflict.client));
                    setBaseUpdatedAt(conflict.client.updatedAt);
                    setConflict(null);
                    toast('Loaded their version.', 'info');
                  }}
                >
                  <IconRefresh size={14} />
                  Load their version
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(event) => {
                    setBaseUpdatedAt(conflict.client.updatedAt);
                    submit(event, conflict.client.updatedAt);
                  }}
                  disabled={saveClient.isPending}
                >
                  Keep mine and overwrite
                </Button>
              </div>
            </div>
          ) : null}

          {conflict?.kind === 'deleted' ? (
            <div className="border-sys-red/40 bg-sys-red/8 rounded-card mb-5 border p-4">
              <div className="text-sys-red flex items-center gap-2 text-[13.5px] font-bold">
                <IconAlert size={16} />
                Someone else deleted this client
              </div>
              <p className="text-ink-soft mt-1.5 text-[12.5px] leading-relaxed">
                It was removed while you were editing, so your changes were not saved. You can put
                the record back with everything you typed, or discard it.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={(event) => {
                    setBaseUpdatedAt(null);
                    submit(event, null);
                  }}
                  disabled={saveClient.isPending}
                >
                  <IconRefresh size={14} />
                  Restore with my changes
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate('/clients')}>
                  Discard
                </Button>
              </div>
            </div>
          ) : null}

          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field id="f-name" label="Full name" error={errors.name} className="sm:col-span-2">
              <TextInput
                id="f-name"
                value={values.name}
                onChange={(event) => set('name', event.target.value)}
                invalid={Boolean(errors.name)}
                placeholder="e.g. Anjali Menon"
                autoComplete="off"
                autoFocus
              />
            </Field>

            <Field
              id="f-guardian"
              label="Guardian name"
              error={errors.guardianName}
              optional
              className="sm:col-span-2"
            >
              <TextInput
                id="f-guardian"
                value={values.guardianName}
                onChange={(event) => set('guardianName', event.target.value)}
                invalid={Boolean(errors.guardianName)}
                placeholder="Father, mother or guardian"
                autoComplete="off"
              />
            </Field>

            <Field
              id="f-application"
              label="Application number"
              error={errors.applicationNumber}
              optional
              hint="RTO or learner licence reference, if you have it."
              className="sm:col-span-2"
            >
              <TextInput
                id="f-application"
                value={values.applicationNumber}
                onChange={(event) => set('applicationNumber', event.target.value)}
                invalid={Boolean(errors.applicationNumber)}
                placeholder="e.g. KL/2026/000123"
                autoComplete="off"
              />
            </Field>

            <Field id="f-phone" label="Phone number" error={errors.phone}>
              <TextInput
                id="f-phone"
                type="tel"
                value={values.phone}
                onChange={(event) => set('phone', event.target.value)}
                invalid={Boolean(errors.phone)}
                placeholder="e.g. 9876543210"
                autoComplete="off"
              />
            </Field>

            <Field
              id="f-alt-phone"
              label="Alternate number"
              error={errors.alternatePhone}
              optional
            >
              <TextInput
                id="f-alt-phone"
                type="tel"
                value={values.alternatePhone}
                onChange={(event) => set('alternatePhone', event.target.value)}
                invalid={Boolean(errors.alternatePhone)}
                placeholder="Second contact number"
                autoComplete="off"
              />
            </Field>

            <Field id="f-dob" label="Date of birth" error={errors.dob}>
              <TextInput
                id="f-dob"
                type="date"
                max={todayYmd()}
                value={values.dob}
                onChange={(event) => set('dob', event.target.value)}
                invalid={Boolean(errors.dob)}
              />
            </Field>

            <Field id="f-blood" label="Blood group" error={errors.bloodGroup}>
              <Select
                id="f-blood"
                value={values.bloodGroup}
                onChange={(value) => set('bloodGroup', value)}
                options={BLOOD_OPTIONS}
                placeholder="Select blood group"
                invalid={Boolean(errors.bloodGroup)}
              />
            </Field>

            <Field
              id="f-licence"
              label="Licence type"
              error={errors.licenceType}
              className="sm:col-span-2"
            >
              <Select
                id="f-licence"
                value={values.licenceType}
                onChange={(value) => set('licenceType', value)}
                options={
                  // A legacy value stays selectable while editing an older record.
                  values.licenceType === 'Transport'
                    ? [...LICENCE_OPTIONS, ...LEGACY_LICENCE_OPTIONS]
                    : LICENCE_OPTIONS
                }
                placeholder="Select licence type"
                invalid={Boolean(errors.licenceType)}
              />
            </Field>

            <Field id="f-address" label="Address" error={errors.address} className="sm:col-span-2">
              <TextArea
                id="f-address"
                rows={3}
                value={values.address}
                onChange={(event) => set('address', event.target.value)}
                invalid={Boolean(errors.address)}
                placeholder="House name, street, town, district, PIN"
              />
            </Field>

            {!isEdit ? (
              <div className="sm:col-span-2">
                <Checkbox
                  id="f-welcome"
                  checked={sendWelcome}
                  onChange={(event) => setSendWelcome(event.target.checked)}
                  label="Send the registration welcome message on WhatsApp"
                />
              </div>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (isEdit && existing) setValues(toFormValues(existing));
                  else setValues(emptyClientForm);
                  setErrors({});
                }}
                disabled={saveClient.isPending}
              >
                Reset
              </Button>
              <Button variant="secondary" onClick={() => navigate('/clients')}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saveClient.isPending}>
                <IconCheck size={15} />
                {saveClient.isPending
                  ? 'Saving…'
                  : isEdit
                    ? 'Update client'
                    : 'Save client'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
