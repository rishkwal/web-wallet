/* eslint-disable camelcase */
import { useState, useEffect, useCallback } from "react"
import { useErrorHandler } from "react-error-boundary"
import {
  SelfServiceRegistrationFlow,
  SubmitSelfServiceRegistrationFlowBody,
} from "@ory/kratos-client"

import { translate } from "@galoymoney/client"

import { config, history, useAuthContext } from "store/index"
import {
  KratosSdk,
  handleFlowError,
  getNodesForFlow,
  KratosFlowData,
  KratosError,
} from "kratos/index"

import Link from "components/link"
import { Messages } from "components/kratos"
import { Icon } from "@galoymoney/react"
import NavBar from "modules/guatt/components/nav-bar"

type FCT = React.FC<{
  flowData?: KratosFlowData
}>

const Register: FCT = ({ flowData: flowDataProp }) => {
  const handleError = useErrorHandler()
  const { syncSession } = useAuthContext()

  const [flowData, setFlowData] = useState<SelfServiceRegistrationFlow | undefined>(
    flowDataProp?.registrationData,
  )

  const resetFlow = useCallback(() => {
    setFlowData(undefined)
    window.location.href = "/register"
  }, [])

  useEffect(() => {
    if (flowData) {
      return
    }

    const kratos = KratosSdk(config.kratosBrowserUrl)
    const params = new URLSearchParams(window.location.search)
    const flowId = params.get("flow")

    // flow id exists, we can fetch the flow data
    if (flowId) {
      kratos
        .getSelfServiceRegistrationFlow(String(flowId), undefined, {
          withCredentials: true,
        })
        .then(({ data }) => {
          setFlowData(data)
        })
        .catch(handleFlowError({ history, resetFlow }))
      return
    }

    // need to initialize the flow
    kratos
      .initializeSelfServiceRegistrationFlowForBrowsers(
        params.get("return_to") || undefined,
        { withCredentials: true },
      )
      .then(({ data }) => {
        setFlowData(data)
      })
      .catch(handleFlowError({ history, resetFlow }))
  }, [flowData, resetFlow])

  const handleKratosRegister = async (values: SubmitSelfServiceRegistrationFlowBody) => {
    const kratos = KratosSdk(config.kratosBrowserUrl)
    kratos
      .submitSelfServiceRegistrationFlow(String(flowData?.id), values, undefined, {
        withCredentials: true,
      })
      .then(async ({ data }) => {
        try {
          if (!data.session) {
            throw new Error("Invalid session")
          }
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
      traits: {
        email: event.currentTarget["traits.email"].value,
      },
      password: event.currentTarget.password.value,
    }

    handleKratosRegister(values)
  }

  const nodes = getNodesForFlow(flowData)

  return (
    <>
      <NavBar back="/welcome"/>
      <h1 className="form-heading">Enter your email and password</h1>
      <div className="register-form auth-form">
        <form action={flowData?.ui.action} method="POST" onSubmit={onSubmit}>
          <input
            type="hidden"
            name="csrf_token"
            value={nodes?.csrf_token.attributes.value}
          />
          <div className="input-container">
            <input
              name="traits.email"
              type="email"
              className="form-input"
              defaultValue={nodes?.["traits.email"].value}
              autoComplete="email"
              placeholder="Escribe tu correo aquí"
              required
            />
            <Messages messages={nodes?.["traits.email"].messages} />
          </div>
          <div className="input-container">
            <input
              name="password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña mínima de 8 dígitos"
              required
            />
            <Messages messages={nodes?.password.messages} />
          </div>
          <div className="input-container">
            <input
              name="retype-password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              placeholder="Re-enter your password"
              required
            />
            <Messages messages={nodes?.password.messages} />
          </div>
          <Messages messages={flowData?.ui?.messages} />
          <div className="button-container">
            <div className="form-links">
              <Link to="/login" className="text-link">
                ¿Ya tienes una cuenta?
              </Link>
            </div>
            <button className="button" name="method" value="password">
              {translate("Create Account")}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default Register
