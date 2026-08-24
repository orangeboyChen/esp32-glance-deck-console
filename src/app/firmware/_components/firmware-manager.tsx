'use client'

import { Alert, Block, Checkbox, Empty, Flexbox, Input, Modal, Select, Tag, Text, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { Cpu, Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect } from 'react'

import { ConsolePageHeader } from '@/app/_components/console-page-header'
import { Api } from '@/lib/api-client'

import {
  firmwareDevicesAtom,
  firmwareErrorAtom,
  firmwareInstallingAtom,
  firmwareLoadingAtom,
  firmwareReleasesAtom,
  firmwareSelectionAtom,
  rolloutBusyAtom,
  rolloutDeviceIdsAtom,
  rolloutPercentageAtom,
  rolloutReleaseIdAtom,
  type Device,
  type FirmwareRelease,
} from '@/app/firmware/_components/state'

export const FirmwareManager = () => {
  const translate = useTranslations('Firmware')
  const locale = useLocale()
  const [releases, setReleases] = useAtom(firmwareReleasesAtom)
  const [devices, setDevices] = useAtom(firmwareDevicesAtom)
  const [loading, setLoading] = useAtom(firmwareLoadingAtom)
  const [error, setError] = useAtom(firmwareErrorAtom)
  const [selection, setSelection] = useAtom(firmwareSelectionAtom)
  const [installing, setInstalling] = useAtom(firmwareInstallingAtom)
  const [rolloutReleaseId, setRolloutReleaseId] = useAtom(rolloutReleaseIdAtom)
  const [rolloutPercentage, setRolloutPercentage] = useAtom(rolloutPercentageAtom)
  const [rolloutDeviceIds, setRolloutDeviceIds] = useAtom(rolloutDeviceIdsAtom)
  const [rolloutBusy, setRolloutBusy] = useAtom(rolloutBusyAtom)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [releaseResponse, deviceResponse] = await Promise.all([Api.listFirmwareReleases(), Api.listDevices()])
      if (!releaseResponse.ok || !deviceResponse.ok) throw new Error('load_failed')
      setReleases(((await releaseResponse.json()) as { releases: FirmwareRelease[] }).releases)
      setDevices(((await deviceResponse.json()) as { devices: Device[] }).devices)
    } catch {
      setError(translate('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [translate, setDevices, setError, setLoading, setReleases])
  useEffect(() => {
    void load()
  }, [load])

  const startRollout = async () => {
    if (!rolloutReleaseId || !rolloutDeviceIds.length) return
    setRolloutBusy(true)
    try {
      const response = await Api.createRollout({
        firmware_release_id: rolloutReleaseId,
        device_ids: rolloutDeviceIds,
        percentage: Number(rolloutPercentage),
      })
      const payload = (await response.json()) as { error?: string; selected_count?: number }
      if (!response.ok) throw new Error(payload.error || 'rolloutFailed')
      toast.success(translate('rolloutQueued', { count: payload.selected_count ?? 0 }))
      setRolloutDeviceIds([])
      await load()
    } catch (rolloutError) {
      const code = rolloutError instanceof Error ? rolloutError.message : 'rolloutFailed'
      toast.error(translate.has(code) ? translate(code) : translate('rolloutFailed'))
    } finally {
      setRolloutBusy(false)
    }
  }

  const install = async () => {
    if (!selection) return
    setInstalling(true)
    try {
      const response = await Api.installOta(selection.device.id, { firmware_release_id: selection.release.id })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'ota_failed')
      toast.success(translate('queued', { device: selection.device.name, version: selection.release.version }))
      setSelection(null)
      await load()
    } catch (installError) {
      const code = installError instanceof Error ? installError.message : 'ota_failed'
      toast.error(translate.has(code) ? translate(code) : translate('otaFailed'))
    } finally {
      setInstalling(false)
    }
  }

  const updateJob = async (device: Device, action: 'cancel' | 'rollback') => {
    if (!device.ota_job_id) return
    try {
      const response = await Api.updateOtaJob(device.ota_job_id, { action })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'otaJobActionFailed')
      toast.success(translate(action === 'cancel' ? 'cancelled' : 'rollbackQueued'))
      await load()
    } catch (jobError) {
      const code = jobError instanceof Error ? jobError.message : 'otaJobActionFailed'
      toast.error(translate.has(code) ? translate(code) : translate('otaJobActionFailed'))
    }
  }

  return (
    <main className="sources-shell">
      <ConsolePageHeader
        backLabel={translate('back')}
        eyebrow={translate('eyebrow')}
        icon={Cpu}
        languageLabel={translate('language')}
        subtitle={translate('subtitle')}
        title={translate('title')}
      />
      <section className="sources-section" aria-labelledby="releases-heading">
        <Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={12}>
          <h2 id="releases-heading">{translate('verifiedReleases')}</h2>
          <Button icon={RefreshCw} onClick={() => void load()}>
            {translate('refresh')}
          </Button>
        </Flexbox>
        {error && <Alert message={error} showIcon type="error" />}
        {loading ? (
          <Text>{translate('loading')}</Text>
        ) : releases.length === 0 ? (
          <Empty className="empty-state" emoji="◌" title={translate('noReleases')} description={translate('noReleasesDescription')} />
        ) : (
          <Flexbox gap={16}>
            {releases.map((release) => (
              <Block className="release-card" key={release.id} variant="outlined">
                <Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={8}>
                  <Flexbox gap={3}>
                    <h3>{release.version}</h3>
                    <Text type="secondary">{release.board_model}</Text>
                  </Flexbox>
                  <Tag color={release.channel === 'stable' ? 'green' : 'gold'} icon={<ShieldCheck aria-hidden size={14} />}>
                    {release.channel}
                  </Tag>
                </Flexbox>
                <Text type="secondary">{translate('verified', { date: new Date(release.verified_at).toLocaleString(locale) })}</Text>
                <a href={release.manifest_url} rel="noreferrer" target="_blank">
                  {translate('viewManifest')}
                </a>
                <div className="compatible-devices">
                  <Text strong>{translate('compatibleDevices')}</Text>
                  {devices.filter((device) => device.board_model === release.board_model).length === 0 ? (
                    <Text type="secondary">{translate('noCompatibleDevices')}</Text>
                  ) : (
                    devices
                      .filter((device) => device.board_model === release.board_model)
                      .map((device) => {
                        const status = device.ota_status || 'none'
                        const cancellable = ['awaiting_confirmation', 'queued'].includes(status)
                        const rollbackable = ['healthy', 'failed'].includes(status)
                        return (
                          <Flexbox
                            className="firmware-device-row"
                            horizontal
                            align="center"
                            justify="space-between"
                            gap={12}
                            key={device.id}
                            wrap="wrap"
                          >
                            <Flexbox gap={2}>
                              <Text>{device.name}</Text>
                              <Text type="secondary">
                                {translate('deviceVersion', { version: device.firmware_version || translate('unknown') })} ·{' '}
                                {translate('otaStatus', { status: status === 'none' ? translate('none') : status })}
                              </Text>
                            </Flexbox>
                            <Flexbox horizontal gap={8} wrap="wrap">
                              <Button
                                disabled={['queued', 'sent', 'downloading', 'verifying', 'rebooting'].includes(status)}
                                icon={Download}
                                onClick={() => setSelection({ device, release })}
                                size="large"
                              >
                                {translate('startUpdate')}
                              </Button>
                              {cancellable && (
                                <Button onClick={() => void updateJob(device, 'cancel')} size="large">
                                  {translate('cancelUpdate')}
                                </Button>
                              )}
                              {rollbackable && (
                                <Button onClick={() => void updateJob(device, 'rollback')} size="large">
                                  {translate('rollback')}
                                </Button>
                              )}
                            </Flexbox>
                          </Flexbox>
                        )
                      })
                  )}
                </div>
              </Block>
            ))}
          </Flexbox>
        )}
      </section>
      <section className="sources-section" aria-labelledby="rollout-heading">
        <h2 id="rollout-heading">{translate('rolloutTitle')}</h2>
        <Text type="secondary">{translate('rolloutDescription')}</Text>
        <Flexbox className="source-form" gap={8}>
          <label htmlFor="rollout-release">{translate('rolloutRelease')}</label>
          <Select
            id="rollout-release"
            options={releases.map((release) => ({
              label: `${release.version} · ${release.channel}`,
              value: release.id,
            }))}
            placeholder={translate('chooseRelease')}
            value={rolloutReleaseId || undefined}
            onChange={(value) => setRolloutReleaseId(String(value ?? ''))}
          />
          <label htmlFor="rollout-percentage">{translate('rolloutPercentage')}</label>
          <Input
            id="rollout-percentage"
            type="number"
            min={1}
            max={100}
            value={rolloutPercentage}
            onChange={(event) => setRolloutPercentage(event.target.value)}
          />
          <fieldset className="alert-targets">
            <legend>{translate('rolloutDevices')}</legend>
            {devices.map((device) => (
              <Checkbox
                checked={rolloutDeviceIds.includes(device.id)}
                key={device.id}
                onChange={(checked) =>
                  setRolloutDeviceIds(checked ? [...rolloutDeviceIds, device.id] : rolloutDeviceIds.filter((id) => id !== device.id))
                }
              >
                {device.name}
              </Checkbox>
            ))}
          </fieldset>
          <Button
            disabled={!rolloutReleaseId || !rolloutDeviceIds.length}
            loading={rolloutBusy}
            onClick={() => void startRollout()}
            type="primary"
          >
            {translate('startRollout')}
          </Button>
        </Flexbox>
      </section>
      <Modal
        open={Boolean(selection)}
        title={translate('confirmTitle')}
        okText={translate('startUpdate')}
        okButtonProps={{ loading: installing }}
        cancelText={translate('cancel')}
        onCancel={() => !installing && setSelection(null)}
        onOk={() => void install()}
      >
        <Flexbox gap={12}>
          <Text>{selection && translate('confirmDescription', { device: selection.device.name, version: selection.release.version })}</Text>
          <Alert showIcon type="warning" message={translate('confirmWarning')} />
        </Flexbox>
      </Modal>
    </main>
  )
}
