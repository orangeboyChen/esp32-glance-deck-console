'use client'

import { Alert, Block, Checkbox, Empty, Flexbox, Input, Segmented, Select, Tag, Text, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { Bell, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useCallback, useEffect } from 'react'

import { ConsolePageHeader } from '@/app/_components/console-page-header'
import { Api } from '@/lib/api-client'

import {
  alertDeviceIdsAtom,
  alertFieldAtom,
  alertFields,
  alertMessageAtom,
  alertNameAtom,
  alertOperatorAtom,
  alertPageIdsAtom,
  alertRulesAtom,
  alertSeverityAtom,
  alertSourceIdAtom,
  alertTestOnlyAtom,
  alertThresholdAtom,
  alertsDevicesAtom,
  alertsErrorAtom,
  alertsLoadingAtom,
  alertsSavingAtom,
  alertsSourcesAtom,
  type Operator,
} from '@/app/alerts/_components/state'

export const AlertsManager = () => {
  const translate = useTranslations('Alerts')
  const [sources, setSources] = useAtom(alertsSourcesAtom)
  const [devices, setDevices] = useAtom(alertsDevicesAtom)
  const [alerts, setAlerts] = useAtom(alertRulesAtom)
  const [loading, setLoading] = useAtom(alertsLoadingAtom)
  const [saving, setSaving] = useAtom(alertsSavingAtom)
  const [error, setError] = useAtom(alertsErrorAtom)
  const [name, setName] = useAtom(alertNameAtom)
  const [sourceId, setSourceId] = useAtom(alertSourceIdAtom)
  const [field, setField] = useAtom(alertFieldAtom)
  const [operator, setOperator] = useAtom(alertOperatorAtom)
  const [threshold, setThreshold] = useAtom(alertThresholdAtom)
  const [deviceIds, setDeviceIds] = useAtom(alertDeviceIdsAtom)
  const [pageIds, setPageIds] = useAtom(alertPageIdsAtom)
  const [severity, setSeverity] = useAtom(alertSeverityAtom)
  const [message, setMessage] = useAtom(alertMessageAtom)
  const [testOnly, setTestOnly] = useAtom(alertTestOnlyAtom)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [alertsResponse, sourcesResponse, devicesResponse] = await Promise.all([Api.listAlerts(), Api.listSources(), Api.listDevices()])
      setAlerts(alertsResponse.rules)
      setSources(sourcesResponse.sources)
      setDevices(devicesResponse.devices)
    } catch {
      setError(translate('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [translate, setAlerts, setDevices, setError, setLoading, setSources])

  useEffect(() => {
    void load()
  }, [load])

  const toggleDevice = (id: string, checked: boolean) =>
    setDeviceIds((current) => (checked ? [...current, id] : current.filter((item) => item !== id)))
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deviceIds.length) {
      setError(translate('targetRequired'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      await Api.createAlert({
        name: name.trim(),
        source_id: sourceId,
        field,
        operator,
        threshold: threshold.trim(),
        device_ids: deviceIds,
        page_ids: pageIds
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        severity,
        message: message.trim() || name.trim(),
        test_only: testOnly,
        enabled: true,
      })
      toast.success(translate('savedToast'))
      setName('')
      setMessage('')
      setDeviceIds([])
      setTestOnly(false)
      await load()
    } catch {
      setError(translate('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await Api.deleteAlert(id)
    } catch {
      toast.error(translate('deleteFailed'))
      return
    }
    toast.success(translate('deleted'))
    setAlerts((current) => current.filter((item) => item.id !== id))
  }

  return (
    <main className="sources-shell alerts-shell">
      <ConsolePageHeader
        backLabel={translate('back')}
        eyebrow={translate('eyebrow')}
        icon={Bell}
        languageLabel={translate('language')}
        subtitle={translate('subtitle')}
        title={translate('title')}
      />

      <section className="sources-section" aria-labelledby="alerts-heading">
        <Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={12}>
          <h2 id="alerts-heading">{translate('saved')}</h2>
          <Button icon={RefreshCw} onClick={() => void load()}>
            {translate('refresh')}
          </Button>
        </Flexbox>
        {loading ? (
          <Text>{translate('loading')}</Text>
        ) : alerts.length === 0 ? (
          <Empty className="empty-state" emoji="🔔" title={translate('none')} description={translate('noneDescription')} />
        ) : (
          <Flexbox gap={10}>
            {alerts.map((item) => (
              <Block className="alert-rule-row" key={item.id} variant="outlined">
                <Flexbox gap={6}>
                  <Flexbox horizontal align="center" gap={8} wrap="wrap">
                    <h3>{item.name}</h3>
                    {item.active && <Tag color="red">{translate('active')}</Tag>}
                    {item.test_only && <Tag color="gold">{translate('testOnly')}</Tag>}
                    <Tag color={item.enabled ? 'green' : 'default'}>{item.enabled ? translate('enabled') : translate('disabled')}</Tag>
                  </Flexbox>
                  <Text type="secondary">
                    {item.source_name ?? item.source_id} · {translate(`field_${item.field}`)} · {translate(`operator_${item.operator}`)}{' '}
                    {item.threshold}
                  </Text>
                  <Text type="secondary">{translate('targets', { count: item.device_ids.length, page: item.page_ids.join(', ') })}</Text>
                  <Text type="secondary">{item.message}</Text>
                </Flexbox>
                <Button aria-label={translate('delete')} icon={Trash2} onClick={() => void remove(item.id)} />
              </Block>
            ))}
          </Flexbox>
        )}
      </section>

      <section className="sources-section" aria-labelledby="new-alert-heading">
        <h2 id="new-alert-heading">{translate('new')}</h2>
        <Text type="secondary">{translate('newDescription')}</Text>
        <form className="source-form alert-form-grid" onSubmit={save}>
          <div className="form-field">
            <label htmlFor="alert-name">{translate('name')}</label>
            <Input id="alert-name" required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="alert-source">{translate('source')}</label>
            <Select
              id="alert-source"
              options={sources.map((source) => ({ label: source.name, value: source.id }))}
              placeholder={translate('chooseSource')}
              value={sourceId || undefined}
              onChange={(value) => setSourceId(String(value ?? ''))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="alert-field">{translate('field')}</label>
            <Select
              id="alert-field"
              options={alertFields.map((item) => ({ label: translate(`field_${item}`), value: item }))}
              value={field}
              onChange={(value) => setField(String(value) as (typeof alertFields)[number])}
            />
          </div>
          <div className="form-field form-field-wide">
            <label>{translate('condition')}</label>
            <Segmented
              options={(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains'] as Operator[]).map((item) => ({
                label: translate(`operator_${item}`),
                value: item,
              }))}
              value={operator}
              onChange={(value) => setOperator(value as Operator)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="alert-threshold">{translate('threshold')}</label>
            <Input id="alert-threshold" required value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </div>
          <fieldset className="alert-targets form-field-wide">
            <legend>{translate('devices')}</legend>
            {devices.length === 0 ? (
              <Text type="secondary">{translate('noDevices')}</Text>
            ) : (
              devices.map((device) => (
                <Checkbox checked={deviceIds.includes(device.id)} key={device.id} onChange={(checked) => toggleDevice(device.id, checked)}>
                  {device.name}
                </Checkbox>
              ))
            )}
          </fieldset>
          <div className="form-field">
            <label htmlFor="alert-severity">{translate('severity')}</label>
            <Segmented
              options={['info', 'warning', 'critical'].map((item) => ({ label: translate(`severity_${item}`), value: item }))}
              value={severity}
              onChange={(value) => setSeverity(String(value))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="alert-message">{translate('message')}</label>
            <Input id="alert-message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="alert-page">{translate('page')}</label>
            <Input id="alert-page" required value={pageIds} onChange={(event) => setPageIds(event.target.value)} />
            <Text type="secondary">{translate('pageHelp')}</Text>
          </div>
          <div className="form-field form-field-wide">
            <Checkbox checked={testOnly} onChange={setTestOnly}>
              {translate('testOnly')}
            </Checkbox>
            {testOnly && <Alert showIcon type="warning" message={translate('testWarning')} />}
          </div>
          {error && (
            <Text className="form-action" role="alert" type="danger">
              {error}
            </Text>
          )}
          <Button className="form-action" htmlType="submit" icon={Save} loading={saving} size="large" type="primary">
            {translate('create')}
          </Button>
        </form>
      </section>
    </main>
  )
}
