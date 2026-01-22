// 勤労の獅子 Plus - Popup スクリプト

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('credential-form');
  const companyInput = document.getElementById('company-code');
  const employeeInput = document.getElementById('employee-code');
  const passwordInput = document.getElementById('password');
  const saveBtn = document.getElementById('save-btn');
  const openPageBtn = document.getElementById('open-page-btn');
  const clearBtn = document.getElementById('clear-btn');
  const messageEl = document.getElementById('message');

  // 保存済みのコードを読み込んで初期値として設定
  await loadSavedCodes();

  // フォーム送信時の処理
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSave();
  });

  // 打刻画面を開くボタン
  openPageBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, {
      url: 'https://kinrouap1.hr44.jp/kinrou/kojin/kintaiDakoku/'
    });
    window.close();
  });

  // 認証情報を削除するボタン
  clearBtn.addEventListener('click', async () => {
    if (!confirm('保存済みの認証情報を削除しますか？')) {
      return;
    }

    try {
      const success = await CredentialManager.clear();
      if (success) {
        companyInput.value = '';
        employeeInput.value = '';
        passwordInput.value = '';
        showMessage('認証情報を削除しました', 'success');
      } else {
        showMessage('削除に失敗しました', 'error');
      }
    } catch (error) {
      console.error('[勤労の獅子] エラー:', error);
      showMessage('削除に失敗しました', 'error');
    }
  });

  /**
   * 保存済みのコードを読み込む
   */
  async function loadSavedCodes() {
    try {
      const savedCodes = await CredentialManager.getSavedCodes();
      if (savedCodes) {
        companyInput.value = savedCodes.companyCode;
        employeeInput.value = savedCodes.employeeCode;
      }
    } catch (error) {
      console.error('[勤労の獅子] 保存済みコードの読み込みに失敗しました:', error);
    }
  }

  /**
   * 認証情報を保存
   */
  async function handleSave() {
    const companyCode = companyInput.value.trim();
    const employeeCode = employeeInput.value.trim();
    const password = passwordInput.value;

    // 必須チェック
    if (!companyCode || !employeeCode || !password) {
      showMessage('すべての項目を入力してください', 'error');
      return;
    }

    // 法人コードのバリデーション
    if (!CredentialManager.isValidCompanyCode(companyCode)) {
      showMessage('法人コードは5桁以下の数字で入力してください', 'error');
      return;
    }

    // 社員コードのバリデーション
    if (!CredentialManager.isValidEmployeeCode(employeeCode)) {
      showMessage('社員コードは10桁以下の数字で入力してください', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
      const success = await CredentialManager.save(companyCode, employeeCode, password);

      if (success) {
        showMessage('認証情報を保存しました。打刻画面へ移動します...', 'success');
        passwordInput.value = '';

        // 少し待ってから打刻画面にリダイレクト
        setTimeout(async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.update(tab.id, {
            url: 'https://kinrouap1.hr44.jp/kinrou/kojin/kintaiDakoku/'
          });
          window.close();
        }, 1000);
      } else {
        showMessage('保存に失敗しました', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }
    } catch (error) {
      console.error('[勤労の獅子] エラー:', error);
      showMessage('保存に失敗しました', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  }

  /**
   * メッセージを表示
   */
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');

    if (type === 'success') {
      messageEl.className = 'text-center text-sm rounded-md p-2 mb-3 bg-green-100 text-green-800 border border-green-300';
    } else if (type === 'error') {
      messageEl.className = 'text-center text-sm rounded-md p-2 mb-3 bg-red-100 text-red-800 border border-red-300';
    }
  }
});
