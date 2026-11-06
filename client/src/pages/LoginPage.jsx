import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { playSignInSplit } from '../components/SplitSignIn';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState('closed'); // closed -> splitting -> open
  const { login } = useAuth();
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const buttonRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  useLayoutEffect(() => {
    if (stage !== 'splitting') return undefined;
    return playSignInSplit(
      canvasRef.current,
      buttonRef.current,
      usernameRef.current,
      passwordRef.current,
      () => setStage('open')
    );
  }, [stage]);

  function handleOpen() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStage(reduceMotion ? 'open' : 'splitting');
    usernameRef.current.focus(); // in the click itself, so phones show the keyboard
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await login(username, password);
      navigate(loggedInUser.role === 'Admin' ? '/admin' : '/shift-start');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
      setSubmitting(false);
    }
  }

  const isClosed = stage === 'closed';

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <img src="/afs_logo.png" alt="Company Logo" className="login-logo" />
        <h1>Handover System</h1>
        <form onSubmit={handleSubmit} className={`login-form login-${stage}`}>
          <div className="login-split">
            <div className="login-boxes">
              <input
                ref={usernameRef}
                type="text"
                placeholder="Username"
                aria-label="Username"
                autoComplete="username"
                tabIndex={isClosed ? -1 : undefined}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                ref={passwordRef}
                type="password"
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
                tabIndex={isClosed ? -1 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {stage !== 'open' && (
              <button
                ref={buttonRef}
                type="button"
                className="btn-primary login-open-button"
                style={isClosed ? undefined : { visibility: 'hidden' }}
                onClick={handleOpen}
              >
                Sign In
              </button>
            )}
            {stage === 'splitting' && <canvas ref={canvasRef} className="login-split-canvas" aria-hidden="true" />}
          </div>
          {error && <p className="error-text login-error">{error}</p>}
          <button
            type="submit"
            className="btn-primary btn-full login-submit"
            disabled={isClosed || submitting}
            tabIndex={isClosed ? -1 : undefined}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
