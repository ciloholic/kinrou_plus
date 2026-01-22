// 勤労の獅子 自動ログイン コンテンツスクリプト

(function() {
  'use strict';

  /**
   * ログイン画面かどうかを判定
   */
  function isLoginPage() {
    const companyCodeInput = document.getElementById('houjin_code');
    const employeeCodeInput = document.getElementById('user_id');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('bt');

    return companyCodeInput && employeeCodeInput && passwordInput && loginButton;
  }

  /**
   * タイムアウトエラー画面かどうかを判定
   */
  function isTimeoutErrorPage() {
    const title = document.title;
    const h2 = document.querySelector('h2');

    return title.includes('タイムアウトエラー') ||
           (h2 && h2.textContent.includes('タイムアウトエラー'));
  }

  /**
   * 500エラー画面(非ログイン状態)かどうかを判定
   */
  function is500ErrorPage() {
    const title = document.title;
    const h1 = document.querySelector('h1');

    return title.includes('500エラー') ||
           (h1 && h1.textContent.trim() === '500');
  }

  /**
   * フォームに認証情報を入力してログイン
   */
  function fillAndSubmit(credentials) {
    const companyCodeInput = document.getElementById('houjin_code');
    const employeeCodeInput = document.getElementById('user_id');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('bt');

    if (!companyCodeInput || !employeeCodeInput || !passwordInput || !loginButton) {
      console.error('[勤労の獅子] ログインフォームの要素が見つかりません');
      return;
    }

    console.log('[勤労の獅子] 自動ログインを実行します');
    companyCodeInput.value = credentials.companyCode;
    employeeCodeInput.value = credentials.employeeCode;
    passwordInput.value = credentials.password;

    // イベントを発火させる
    companyCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    employeeCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

    loginButton.click();
  }

  /**
   * タイムアウトエラー画面からログイン画面へリダイレクト
   */
  function redirectToLogin() {
    console.log('[勤労の獅子] エラーを検知しました。ログイン画面へ移動します');
    window.location.href = '/kinrou/kojin/';
  }

  /**
   * Service Workerから認証情報を取得
   */
  async function getCredentials() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS' }, (response) => {
        resolve(response);
      });
    });
  }

  /**
   * Service Workerから保存済みコードを取得
   */
  async function getSavedCodes() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SAVED_CODES' }, (response) => {
        resolve(response);
      });
    });
  }

  /**
   * メイン処理
   */
  async function main() {
    console.log('[勤労の獅子] 拡張機能を初期化しています');

    // タイムアウトエラー画面の場合
    if (isTimeoutErrorPage()) {
      redirectToLogin();
      return;
    }

    // 500エラー画面(非ログイン状態)の場合
    if (is500ErrorPage()) {
      redirectToLogin();
      return;
    }

    // ログイン画面の場合
    if (isLoginPage()) {
      try {
        // 保存された認証情報を取得
        const credentials = await getCredentials();

        if (credentials) {
          console.log('[勤労の獅子] 保存された認証情報を検出しました');
          // 少し待ってから自動ログイン
          setTimeout(() => {
            fillAndSubmit(credentials);
          }, 500);
        } else {
          // 保存済みのコードがあるかチェック
          const savedCodes = await getSavedCodes();
          if (savedCodes) {
            console.log('[勤労の獅子] ブラウザ再起動後のためパスワードの再入力が必要です。拡張機能アイコンから設定してください');
          } else {
            console.log('[勤労の獅子] 認証情報が保存されていません。拡張機能アイコンから設定してください');
          }
        }
      } catch (error) {
        console.error('[勤労の獅子] 認証情報の取得に失敗しました:', error);
      }
    }
  }

  // DOMの読み込み完了を待つ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
