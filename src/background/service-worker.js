// 勤労の獅子 Plus - Service Worker

// ストレージのキー名
const STORAGE_KEY_COMPANY = 'kinrou_company_code';
const STORAGE_KEY_EMPLOYEE = 'kinrou_employee_code';
const STORAGE_KEY_PASSWORD = 'kinrou_encrypted_password';
const STORAGE_KEY_IV = 'kinrou_password_iv';
const SESSION_KEY_CRYPTO = 'kinrou_crypto_key';

/**
 * 暗号化キーを取得(存在しない場合はnull)
 * @returns {Promise<CryptoKey|null>}
 */
async function getCryptoKey() {
  const result = await chrome.storage.session.get(SESSION_KEY_CRYPTO);
  const storedKey = result[SESSION_KEY_CRYPTO];

  if (!storedKey) {
    return null;
  }

  return await crypto.subtle.importKey(
    'raw',
    new Uint8Array(storedKey),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * パスワードを復号
 * @param {number[]} encryptedData
 * @param {number[]} iv
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
async function decryptPassword(encryptedData, iv, key) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(encryptedData)
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * 認証情報を取得
 * @returns {Promise<{companyCode: string, employeeCode: string, password: string} | null>}
 */
async function getCredentials() {
  try {
    // 暗号化キーを取得(セッションが切れていればnull)
    const cryptoKey = await getCryptoKey();

    if (!cryptoKey) {
      console.log('[勤労の獅子] 暗号化キーがありません(ブラウザ再起動後)');
      return null;
    }

    // chrome.storage.local から取得
    const result = await chrome.storage.local.get([
      STORAGE_KEY_COMPANY,
      STORAGE_KEY_EMPLOYEE,
      STORAGE_KEY_PASSWORD,
      STORAGE_KEY_IV
    ]);

    const companyCode = result[STORAGE_KEY_COMPANY];
    const employeeCode = result[STORAGE_KEY_EMPLOYEE];
    const encryptedPassword = result[STORAGE_KEY_PASSWORD];
    const iv = result[STORAGE_KEY_IV];

    if (!companyCode || !employeeCode || !encryptedPassword || !iv) {
      return null;
    }

    // パスワードを復号
    const password = await decryptPassword(encryptedPassword, iv, cryptoKey);

    return {
      companyCode,
      employeeCode,
      password
    };
  } catch (error) {
    console.error('[勤労の獅子] 認証情報の取得に失敗しました:', error);
    return null;
  }
}

/**
 * 保存済みの法人コードと社員コードを取得
 * @returns {Promise<{companyCode: string, employeeCode: string} | null>}
 */
async function getSavedCodes() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEY_COMPANY,
      STORAGE_KEY_EMPLOYEE
    ]);

    const companyCode = result[STORAGE_KEY_COMPANY];
    const employeeCode = result[STORAGE_KEY_EMPLOYEE];

    if (!companyCode || !employeeCode) {
      return null;
    }

    return { companyCode, employeeCode };
  } catch (error) {
    console.error('[勤労の獅子] 保存済みコードの取得に失敗しました:', error);
    return null;
  }
}

/**
 * 送信元が許可されたURLかどうかを検証
 * @param {chrome.runtime.MessageSender} sender
 * @returns {boolean}
 */
function isValidSender(sender) {
  // 拡張機能自身からのメッセージは許可
  if (sender.id === chrome.runtime.id) {
    // Content Scriptからの場合はURLを検証
    if (sender.url) {
      return sender.url.startsWith('https://kinrouap1.hr44.jp/');
    }
    // Popup等の拡張機能ページからは許可
    return true;
  }
  return false;
}

/**
 * Content Scriptからのメッセージを処理
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 送信元を検証
  if (!isValidSender(sender)) {
    console.warn('[勤労の獅子] 不正な送信元からのメッセージを拒否しました:', sender);
    sendResponse(null);
    return false;
  }

  if (message.type === 'GET_CREDENTIALS') {
    getCredentials().then(sendResponse);
    return true; // 非同期レスポンスを示す
  }

  if (message.type === 'GET_SAVED_CODES') {
    getSavedCodes().then(sendResponse);
    return true;
  }
});
