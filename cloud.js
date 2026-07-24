(() => {
  const config = window.ADVENTURE_HUB_SUPABASE;
  const library = window.supabase;
  if (!config?.url || !config?.publishableKey || !library?.createClient) {
    console.error('Travel Journal cloud configuration could not be loaded.');
    return;
  }

  const client = library.createClient(config.url, config.publishableKey);
  const gate = document.querySelector('#authGate');
  const form = document.querySelector('#authForm');
  const email = document.querySelector('#authEmail');
  const password = document.querySelector('#authPassword');
  const message = document.querySelector('#authMessage');
  const recoveryForm = document.querySelector('#recoveryForm');
  const recoveryPassword = document.querySelector('#recoveryPassword');
  const recoveryPasswordConfirm = document.querySelector('#recoveryPasswordConfirm');
  const recoveryMessage = document.querySelector('#recoveryMessage');
  const recoverySignOut = document.querySelector('#recoverySignOut');
  const signOut = document.querySelector('#cloudSignOut');
  const status = document.querySelector('#cloudAccountStatus');
  const passwordCard = document.querySelector('#passwordCard');
  const accountPasswordForm = document.querySelector('#accountPasswordForm');
  const accountPassword = document.querySelector('#accountPassword');
  const accountPasswordConfirm = document.querySelector('#accountPasswordConfirm');
  const accountPasswordMessage = document.querySelector('#accountPasswordMessage');
  const joinForm = document.querySelector('#joinForm');
  const joinSignOut = document.querySelector('#joinSignOut');
  let recoveringPassword = window.location.hash.includes('type=recovery')
    || new URLSearchParams(window.location.search).get('type') === 'recovery';

  const setMessage = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle('error', isError);
  };

  const setBusy = busy => {
    form.querySelectorAll('button,input').forEach(control => {
      control.disabled = busy;
    });
  };

  function showRecovery() {
    gate.hidden = false;
    document.body.classList.add('auth-locked');
    document.body.classList.remove('viewer-mode');
    form.hidden = true;
    joinForm.hidden = true;
    recoveryForm.hidden = false;
    recoveryMessage.textContent = '';
    status.textContent = 'Choose a new password.';
    signOut.hidden = true;
    passwordCard.hidden = true;
  }

  async function getMembership(user) {
    const membership = await client
      .from('household_members')
      .select('household_id, role, households(name)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership.error) throw membership.error;
    return membership.data;
  }

  async function activate(session) {
    if (!session?.user) {
      gate.hidden = false;
      document.body.classList.add('auth-locked');
      document.body.classList.remove('viewer-mode');
      form.hidden = false;
      recoveryForm.hidden = true;
      joinForm.hidden = true;
      status.textContent = 'Sign in to connect this device.';
      signOut.hidden = true;
      passwordCard.hidden = true;
      return;
    }

    try {
      const membership = await getMembership(session.user);
      if (!membership) {
        gate.hidden = false;
        document.body.classList.add('auth-locked');
        form.hidden = true;
        recoveryForm.hidden = true;
        joinForm.hidden = false;
        status.textContent = 'This account is awaiting access approval.';
        signOut.hidden = true;
        passwordCard.hidden = true;
        return;
      }
      window.ADVENTURE_HUB_CLOUD = {
        client,
        user: session.user,
        householdId: membership.household_id,
        role: membership.role
      };
      gate.hidden = true;
      recoveryForm.hidden = true;
      document.body.classList.remove('auth-locked');
      document.body.classList.toggle('viewer-mode', membership.role === 'viewer');
      status.textContent = `Connected as ${session.user.email} · ${membership.households?.name || 'Higgins Hub'} · ${membership.role === 'viewer' ? 'Family Viewer' : membership.role === 'editor' ? 'Full access' : 'Owner'}`;
      signOut.hidden = false;
      passwordCard.hidden = false;
      window.dispatchEvent(new CustomEvent('adventure-cloud-ready', {
        detail: window.ADVENTURE_HUB_CLOUD
      }));
    } catch (error) {
      gate.hidden = false;
      document.body.classList.add('auth-locked');
      setMessage(error.message || 'The secure connection could not be completed.', true);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setBusy(true);
    setMessage('Signing in…');
    const result = await client.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    });
    setBusy(false);
    if (result.error) setMessage(result.error.message, true);
  });

  recoveryForm.addEventListener('submit', async event => {
    event.preventDefault();
    recoveryMessage.classList.remove('error');
    if (recoveryPassword.value !== recoveryPasswordConfirm.value) {
      recoveryMessage.textContent = 'The passwords do not match.';
      recoveryMessage.classList.add('error');
      return;
    }
    recoveryForm.querySelectorAll('button,input').forEach(control => {
      control.disabled = true;
    });
    recoveryMessage.textContent = 'Saving your new password…';
    const result = await client.auth.updateUser({
      password: recoveryPassword.value
    });
    recoveryForm.querySelectorAll('button,input').forEach(control => {
      control.disabled = false;
    });
    if (result.error) {
      recoveryMessage.textContent = result.error.message;
      recoveryMessage.classList.add('error');
      return;
    }
    recoveringPassword = false;
    recoveryPassword.value = '';
    recoveryPasswordConfirm.value = '';
    const session = (await client.auth.getSession()).data.session;
    await activate(session);
  });

  recoverySignOut.addEventListener('click', async () => {
    recoveringPassword = false;
    await client.auth.signOut();
    await activate(null);
  });

  signOut.addEventListener('click', async () => {
    await client.auth.signOut();
  });

  accountPasswordForm.addEventListener('submit', async event => {
    event.preventDefault();
    accountPasswordMessage.classList.remove('error');
    if (accountPassword.value !== accountPasswordConfirm.value) {
      accountPasswordMessage.textContent = 'The passwords do not match.';
      accountPasswordMessage.classList.add('error');
      return;
    }
    accountPasswordForm.querySelectorAll('button,input').forEach(control => {
      control.disabled = true;
    });
    accountPasswordMessage.textContent = 'Saving your new password…';
    const result = await client.auth.updateUser({
      password: accountPassword.value
    });
    accountPasswordForm.querySelectorAll('button,input').forEach(control => {
      control.disabled = false;
    });
    if (result.error) {
      accountPasswordMessage.textContent = result.error.message;
      accountPasswordMessage.classList.add('error');
      return;
    }
    accountPassword.value = '';
    accountPasswordConfirm.value = '';
    accountPasswordMessage.textContent = 'Password updated. You can now use it on another device.';
  });

  joinSignOut.addEventListener('click', async () => {
    await client.auth.signOut();
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveringPassword = true;
      window.setTimeout(showRecovery, 0);
      return;
    }
    if (recoveringPassword) return;
    window.setTimeout(() => activate(session), 0);
  });

  client.auth.getSession().then(({ data }) => {
    if (recoveringPassword && data.session) {
      showRecovery();
      return;
    }
    activate(data.session);
  });
})();
