/* reset_password.js
   - flow:
     1) user submits username -> call backend to send OTP (here simulated)
     2) show OTP UI, start 60s timer (resend disabled)
     3) auto-advance OTP boxes, backspace to previous
     4) when OTP filled, enable Verify button
     5) Verify (simulate) -> show new password form
     6) Reset password -> call backend (simulate)
*/

// ELEMENTS
const usernameForm = document.getElementById('usernameForm');
const usernameInput = document.getElementById('username');
const usernameSubmit = document.getElementById('usernameSubmit');
const usernameHint = document.getElementById('usernameHint');

const otpCard = document.getElementById('otpCard');
const otpBoxes = Array.from(document.querySelectorAll('.otp-box'));
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const resendBtn = document.getElementById('resendBtn');
const timerSpan = document.getElementById('timer');
const sentTo = document.getElementById('sentTo');
const cancelOtp = document.getElementById('cancelOtp');

const resetForm = document.getElementById('resetForm');
const backToOtp = document.getElementById('backToOtp');
const submitNewPassword = document.getElementById('submitNewPassword');

const messageBox = document.getElementById('messageBox');

// State
let resendTimer = 60;
let resendInterval = null;
let simulatedSentEmail = ''; // display in UI for demo
let currentUsername = null;

// HELPERS
function showMessage(text, type='info'){
  const colors = { info: 'text-muted', success:'text-success', error:'text-danger' };
  messageBox.innerHTML = `<div class="${colors[type] || 'text-muted'}">${text}</div>`;
}

function startResendCountdown(){
  resendTimer = 60;
  resendBtn.disabled = true;
  timerSpan.textContent = resendTimer;
  resendInterval = setInterval(() => {
    resendTimer--;
    timerSpan.textContent = resendTimer;
    if (resendTimer <= 0){
      clearInterval(resendInterval);
      resendBtn.disabled = false;
      timerSpan.textContent = '0';
      resendBtn.textContent = 'Resend';
    }
  }, 1000);
}

function focusFirstOtp(){
  otpBoxes.forEach(b => b.value = '');
  otpBoxes[0].focus();
  verifyOtpBtn.disabled = true;
}

function getOtpValue(){
  return otpBoxes.map(b=>b.value.trim()).join('');
}

function enableVerifyIfFull(){
  verifyOtpBtn.disabled = otpBoxes.some(b => b.value.trim() === '');
}

// FLOW: username submit
usernameSubmit.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username){
    showMessage('Please enter your username or email.', 'error');
    usernameInput.focus();
    return;
  }

  // TODO: call backend endpoint to send OTP (POST /api/send-otp { username })
  // For now simulate:
  currentUsername = username;
  simulatedSentEmail = `${username}@example.com`; // demo only
  sentTo.textContent = `Code sent to: ${simulatedSentEmail}`;
  showMessage('OTP sent. Please check your email.', 'success');

  // show OTP area
  usernameForm.classList.add('d-none');
  otpCard.classList.remove('d-none');
  resetForm.classList.add('d-none');

  // start timer and focus
  startResendCountdown();
  focusFirstOtp();
});

// OTP input behavior: auto-advance, backspace
otpBoxes.forEach((box, idx) => {
  box.addEventListener('input', (e) => {
    const v = e.target.value;
    // keep only digits
    e.target.value = v.replace(/[^\d]/g, '').slice(0,1);

    if (e.target.value && idx < otpBoxes.length - 1){
      otpBoxes[idx+1].focus();
    }
    enableVerifyIfFull();
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace'){
      if (!e.target.value && idx > 0){
        otpBoxes[idx-1].focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0){
      otpBoxes[idx-1].focus();
    } else if (e.key === 'ArrowRight' && idx < otpBoxes.length -1){
      otpBoxes[idx+1].focus();
    }
  });

  // Paste support: if user pastes full code into any box
  box.addEventListener('paste', (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    const digits = paste.replace(/\D/g, '').slice(0, otpBoxes.length).split('');
    digits.forEach((d, i) => otpBoxes[i].value = d);
    enableVerifyIfFull();
    // focus last filled or next
    const firstEmpty = otpBoxes.findIndex(b => b.value === '');
    if (firstEmpty === -1) otpBoxes[otpBoxes.length-1].focus(); else otpBoxes[firstEmpty].focus();
  });
});

// Verify OTP
verifyOtpBtn.addEventListener('click', () => {
  const otp = getOtpValue();
  if (otp.length !== 6){
    showMessage('Enter the full 6-digit code.', 'error');
    return;
  }

  // TODO: call backend verify OTP endpoint, e.g. POST /api/verify-otp { username, otp }
  // Simulate success when otp === '123456' OR accept any for demo:
  const simulatedValid = true; // change for stricter demo: otp === '123456'
  if (simulatedValid){
    showMessage('OTP verified. You can now reset your password.', 'success');
    otpCard.classList.add('d-none');
    resetForm.classList.remove('d-none');
    // clear otp boxes
    otpBoxes.forEach(b => b.value = '');
  } else {
    showMessage('Invalid OTP. Please try again.', 'error');
  }
});

// Cancel OTP (go back to username)
cancelOtp.addEventListener('click', () => {
  otpCard.classList.add('d-none');
  usernameForm.classList.remove('d-none');
  messageBox.innerHTML = '';
  if (resendInterval) { clearInterval(resendInterval); resendInterval = null; }
  resendBtn.disabled = true;
});

// Resend
resendBtn.addEventListener('click', () => {
  if (resendBtn.disabled) return;
  if (!currentUsername){
    showMessage('No username available to resend to.', 'error');
    return;
  }
  // TODO: call backend resend endpoint
  showMessage('OTP resent to your email.', 'success');
  startResendCountdown();
  focusFirstOtp();
});

// Back from password form to OTP
backToOtp.addEventListener('click', () => {
  resetForm.classList.add('d-none');
  otpCard.classList.remove('d-none');
  showMessage('Enter the OTP sent to your email.', 'info');
  focusFirstOtp();
});

// Submit new password
submitNewPassword.addEventListener('click', () => {
  const newP = document.getElementById('newPassword').value.trim();
  const confP = document.getElementById('confirmPassword').value.trim();
  if (!newP || !confP) {
    showMessage('Please fill both password fields.', 'error'); return;
  }
  if (newP.length < 6) { showMessage('Password should be at least 6 characters.', 'error'); return; }
  if (newP !== confP) { showMessage('Passwords do not match.', 'error'); return; }

  // TODO: call backend change password endpoint: POST /api/reset-password { username, otp, newPassword }
  // Simulate success:
  showMessage('Password reset successful. You can now log in.', 'success');

  // Optionally redirect to login after short delay
  setTimeout(() => {
    window.location.href = '/login.html'; // adjust path as needed
  }, 1200);
});

// enable verify button whenever OTP boxes are full
otpBoxes.forEach(b => b.addEventListener('input', enableVerifyIfFull));

// Initialize: ensure correct UI on load
(function init(){
  usernameForm.classList.remove('d-none');
  otpCard.classList.add('d-none');
  resetForm.classList.add('d-none');
  messageBox.innerHTML = '';
})();
