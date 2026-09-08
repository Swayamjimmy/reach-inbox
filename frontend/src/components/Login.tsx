import { loginWithGoogle } from "../api";

export default function Login() {
  const error = new URLSearchParams(location.search).get("error");

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Login</h1>

        <button className="google-button" onClick={loginWithGoogle}>
          <span className="google-mark">G</span>
          Login with Google
        </button>

        <div className="or">
          <span />
          or sign up through email
          <span />
        </div>

        <input className="login-input" placeholder="Email ID" disabled />

        <input
          className="login-input"
          placeholder="Password"
          type="password"
          disabled
        />

        <button className="login-button" disabled>
          Login
        </button>

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}