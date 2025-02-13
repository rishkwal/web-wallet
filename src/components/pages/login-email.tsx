/* eslint-disable camelcase */
import { useState, useEffect, useCallback } from "react"
import { useErrorHandler } from "react-error-boundary"
import { SelfServiceLoginFlow, SubmitSelfServiceLoginFlowBody } from "@ory/kratos-client"

import {
  KratosSdk,
  handleFlowError,
  getNodesForFlow,
  KratosFlowData,
  KratosError,
} from "kratos/index"
import { config, translate, history, useAuthContext } from "store/index"

import Link from "components/link"
import { Messages } from "components/kratos"
import Icon from "components/icon"

type FCT = React.FC<{
  flowData?: KratosFlowData
}>

const LoginEmail: FCT = ({ flowData: flowDataProp }) => {
  const handleError = useErrorHandler()
  const { syncSession } = useAuthContext()
  const [flowData, setFlowData] = useState<SelfServiceLoginFlow | undefined>(
    flowDataProp?.loginData,
  )

  const resetFlow = useCallback(() => {
    setFlowData(undefined)
    window.location.href = "/login"
  }, [])

  useEffect(() => {
    if (flowData) {
      return
    }

    const kratos = KratosSdk(config.kratosBrowserUrl)
    const params = new URLSearchParams(window.location.search)
    const flowId = params.get("flow")
    const returnTo = params.get("return_to")
    const refresh = params.get("refresh")
    const aal = params.get("all")

    // flow id exists, we can fetch the flow data
    if (flowId) {
      kratos
        .getSelfServiceLoginFlow(String(flowId), undefined, { withCredentials: true })
        .then(({ data }) => {
          setFlowData(data)
        })
        .catch(handleFlowError({ history, resetFlow }))
      return
    }

    // need to initialize the flow
    kratos
      .initializeSelfServiceLoginFlowForBrowsers(
        Boolean(refresh),
        aal ? String(aal) : undefined,
        returnTo ? String(returnTo) : undefined,
      )
      .then(({ data }) => {
        setFlowData(data)
      })
      .catch(handleFlowError({ history, resetFlow }))
  }, [flowData, resetFlow])

  const handlesyncSession = async (values: SubmitSelfServiceLoginFlowBody) => {
    const kratos = KratosSdk(config.kratosBrowserUrl)
    kratos
      .submitSelfServiceLoginFlow(String(flowData?.id), values, undefined, undefined, {
        withCredentials: true,
      })
      .then(async () => {
        try {
          const syncStatus = await syncSession()
          if (syncStatus instanceof Error) {
            handleError(syncStatus)
            return
          }
          history.push("/")
        } catch (err) {
          console.error(err)
        }
      })
      .catch(handleFlowError({ history, resetFlow }))
      .catch((err: KratosError) => {
        // If the previous handler did not catch the error it's most likely a form validation error
        if (err.response?.status === 400) {
          setFlowData(err.response?.data)
          return
        }

        return Promise.reject(err)
      })
  }

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.stopPropagation()
    event.preventDefault()

    const values = {
      method: "password",
      csrf_token: event.currentTarget.csrf_token.value,
      identifier: event.currentTarget.identifier.value,
      password: event.currentTarget.password.value,
    }

    handlesyncSession(values)
  }

  const nodes = getNodesForFlow(flowData)

  return (
    <>
      <div className="login-form auth-form">
        <form action={flowData?.ui.action} method="POST" onSubmit={onSubmit}>
          <input
            type="hidden"
            name="csrf_token"
            value={nodes?.csrf_token.attributes.value}
          />
          <div className="input-container">
            <div className="">{translate("Email")}</div>
            <input
              name="identifier"
              type="email"
              defaultValue={nodes?.identifier.attributes.value}
              autoComplete="email"
              required
            />
            <Messages messages={nodes?.identifier.messages} />
          </div>
          <div className="input-container">
            <div className="">{translate("Password")}</div>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Messages messages={nodes?.password.messages} />
          </div>
          <Messages messages={flowData?.ui?.messages} />
          <div className="button-container">
            <button className="button" name="method" value="password">
              {translate("Login")}
            </button>
            <Link to="/">{translate("Cancel")}</Link>
          </div>
        </form>
      </div>
      <div className="form-links">
        <Link to="/register">
          <Icon name="login" />
          {translate("Create new account")}
        </Link>
        <div className="separator">|</div>
        <Link to="/recovery">
          <Icon name="key" />
          {translate("Recover your account")}
        </Link>
      </div>
    </>
  )
}

export default LoginEmail
