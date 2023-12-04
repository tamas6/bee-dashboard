import { PostageBatchOptions } from '@ethersphere/bee-js'
import { Box, Grid, Typography } from '@material-ui/core'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import { useSnackbar } from 'notistack'
import { ReactElement, useContext, useState } from 'react'
import Check from 'remixicon-react/CheckLineIcon'
import { SwarmButton } from '../../components/SwarmButton'
import { SwarmSelect } from '../../components/SwarmSelect'
import { SwarmTextInput } from '../../components/SwarmTextInput'
import { Context as BeeContext } from '../../providers/Bee'
import { Context as SettingsContext } from '../../providers/Settings'
import { Context as StampsContext } from '../../providers/Stamps'
import {
  calculateStampPrice,
  convertAmountToSeconds,
  convertDepthToBytes,
  secondsToTimeString,
  waitUntilStampExists,
} from '../../utils'
import { getHumanReadableFileSize } from '../../utils/file'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../routes'

interface Props {
  onFinished: () => void
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    link: {
      color: '#dd7700',
      textDecoration: 'underline',
      '&:hover': {
        textDecoration: 'none',

        // https://github.com/mui-org/material-ui/issues/22543
        '@media (hover: none)': {
          textDecoration: 'none',
        },
      },
    },
  }),
)

export function PostageStampAdvancedCreation({ onFinished }: Props): ReactElement {
  const classes = useStyles()
  const { chainState } = useContext(BeeContext)
  const { refresh } = useContext(StampsContext)
  const { beeDebugApi } = useContext(SettingsContext)

  const [depthInput, setDepthInput] = useState<string>('')
  const [amountInput, setAmountInput] = useState<string>('')
  const [labelInput, setLabelInput] = useState('')
  const [immutable, setImmutable] = useState(false)
  const [depthError, setDepthError] = useState<string>('')
  const [amountError, setAmountError] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const { enqueueSnackbar } = useSnackbar()

  function getFileSize(depth: number): string {
    if (isNaN(depth) || depth < 17 || depth > 255) {
      return '-'
    }

    return `~${getHumanReadableFileSize(convertDepthToBytes(depth))}`
  }

  function getTtl(amount: number): string {
    const isCurrentPriceAvailable = chainState && chainState.currentPrice

    if (amount <= 0 || !isCurrentPriceAvailable) {
      return '-'
    }

    const pricePerBlock = Number.parseInt(chainState.currentPrice, 10)

    return `${secondsToTimeString(
      convertAmountToSeconds(amount, pricePerBlock),
    )} (with price of ${pricePerBlock.toFixed(0)} per block)`
  }

  function getPrice(depth: number, amount: bigint): string {
    const hasInvalidInput = amount <= 0 || isNaN(depth) || depth < 17 || depth > 255

    if (hasInvalidInput) {
      return '-'
    }

    const price = calculateStampPrice(depth, amount)

    return `${price.toSignificantDigits()} xBZZ`
  }

  async function submit() {
    try {
      // This is really just a typeguard, the validation pretty much guarantees these will have the right values
      if (!depthInput || !amountInput) {
        return
      }

      if (!beeDebugApi) {
        return
      }

      setSubmitting(true)
      const amount = BigInt(amountInput)
      const depth = Number.parseInt(depthInput)
      const options: PostageBatchOptions = {
        waitForUsable: false,
        label: labelInput || undefined,
        immutableFlag: immutable,
      }

      const batchId = await beeDebugApi.createPostageBatch(amount.toString(), depth, options)
      await waitUntilStampExists(batchId, beeDebugApi)
      await refresh()
      onFinished()
    } catch (e) {
      console.error(e) // eslint-disable-line
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    }
    setSubmitting(false)
  }

  function validateAmountInput(amountInput: string) {
    let validAmountInput = '0'

    if (!amountInput) {
      setAmountError('Required field')
    } else {
      if (amountInput.indexOf('.') > -1) {
        setAmountError('Amount must be an integer')
      } else {
        const amount = new BigNumber(amountInput)

        if (amount.isNaN()) {
          setAmountError('Amount must contain only digits')
        } else if (amount.isLessThanOrEqualTo(0)) {
          setAmountError('Amount must be greater than 0')
        } else {
          setAmountError('')
          validAmountInput = amountInput
        }
      }
    }

    setAmountInput(validAmountInput)
  }

  function validateDepthInput(depthInput: string) {
    let validDepthInput = '0'

    if (!depthInput) {
      setDepthError('Required field')
    } else {
      const depth = new BigNumber(depthInput)

      if (!depth.isInteger()) {
        setDepthError('Depth must be an integer')
      } else if (depth.isLessThan(17)) {
        setDepthError('Minimal depth is 17')
      } else if (depth.isGreaterThan(255)) {
        setDepthError('Depth has to be at most 255')
      } else {
        setDepthError('')
        validDepthInput = depthInput
      }
    }

    setDepthInput(validDepthInput)
  }

  return (
    <>
      <Box mb={1}>
        <Typography variant="h2">Batch name</Typography>
      </Box>
      <Box mb={2}>
        <SwarmTextInput name="label" label="Label" optional onChange={event => setLabelInput(event.target.value)} />
      </Box>
      <Box mb={2}>
        <SwarmSelect
          label="Immutable"
          defaultValue="No"
          onChange={event => setImmutable(event.target.value === 'Yes')}
          options={[
            { value: 'Yes', label: 'Yes' },
            { value: 'No', label: 'No' },
          ]}
        />
      </Box>
      <Box mb={2}>
        <SwarmTextInput name="depth" label="Batch depth" onChange={event => validateDepthInput(event.target.value)} />
        <Box mt={0.25} sx={{ bgcolor: '#f6f6f6' }} p={2}>
          <Grid container justifyContent="space-between">
            <Typography>Corresponding file size</Typography>
            <Typography>{!depthError && depthInput ? getFileSize(parseInt(depthInput, 10)) : '-'}</Typography>
          </Grid>
        </Box>
        {depthError && <Typography>{depthError}</Typography>}
      </Box>
      <Box mb={2}>
        <SwarmTextInput name="amount" label="Amount" onChange={event => validateAmountInput(event.target.value)} />
        <Box mt={0.25} sx={{ bgcolor: '#f6f6f6' }} p={2}>
          <Grid container justifyContent="space-between">
            <Typography>Corresponding TTL (Time to live)</Typography>
            <Typography>{!amountError && amountInput ? getTtl(Number.parseInt(amountInput, 10)) : '-'}</Typography>
          </Grid>
        </Box>
        <Box display="flex" justifyContent={'right'} mt={0.5}>
          <Typography style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.26)' }}>
            Current price of 24000 per block
          </Typography>
        </Box>
        {amountError && <Typography>{amountError}</Typography>}
      </Box>

      <Box mb={4} sx={{ bgcolor: '#fcf2e8' }} p={2}>
        <Grid container justifyContent="space-between">
          <Typography>Indicative Price</Typography>
          <Typography>
            {!amountError && !depthError && amountInput && depthInput
              ? getPrice(parseInt(depthInput, 10), BigInt(amountInput))
              : '-'}
          </Typography>
        </Grid>
      </Box>

      <Grid container justifyContent="space-between" alignItems="center">
        <Grid item>
          <SwarmButton
            disabled={submitting || Boolean(depthError) || Boolean(amountError) || !depthInput || !amountInput}
            onClick={submit}
            iconType={Check}
            loading={submitting}
          >
            Buy New Stamp
          </SwarmButton>
        </Grid>
        <Grid item>
          <Link to={ROUTES.ACCOUNT_STAMPS_NEW_STANDARD} className={classes.link}>
            Standard mode
          </Link>
        </Grid>
      </Grid>
    </>
  )
}