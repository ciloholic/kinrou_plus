// 勤労の獅子 認証情報管理クラス(Popup用)
// chrome.storage API + Web Crypto API(AES-GCM暗号化)を使用

/**
 * 認証情報を管理するクラス
 * - 法人コード/社員コード: chrome.storage.local に平文で保存(永続)
 * - パスワード: AES-GCMで暗号化して chrome.storage.local に保存
 * - 暗号化キー: chrome.storage.session に保存(ブラウザを閉じると消去)
 *
 * ブラウザを閉じると暗号化キーが消えるため、パスワードは復号不能になる
 */
class CredentialManager {
  // ストレージのキー名
  static STORAGE_KEY_COMPANY = 'kinrou_company_code';
  static STORAGE_KEY_EMPLOYEE = 'kinrou_employee_code';
  static STORAGE_KEY_PASSWORD = 'kinrou_encrypted_password';
  static STORAGE_KEY_IV = 'kinrou_password_iv';
  static SESSION_KEY_CRYPTO = 'kinrou_crypto_key';

  /**
   * 法人コードのバリデーション(5桁以下の数字)
   * @param {string} companyCode
   * @returns {boolean}
   */
  static isValidCompanyCode(companyCode) {
    return /^\d{1,5}$/.test(companyCode);
  }

  /**
   * 社員コードのバリデーション(10桁以下の数字)
   * @param {string} employeeCode
   * @returns {boolean}
   */
  static isValidEmployeeCode(employeeCode) {
    return /^\d{1,10}$/.test(employeeCode);
  }

  /**
   * 暗号化キーを生成または取得
   * @returns {Promise<CryptoKey>}
   */
  static async getOrCreateCryptoKey() {
    // セッションストレージから既存のキーを取得
    const result = await chrome.storage.session.get(this.SESSION_KEY_CRYPTO);
    const storedKey = result[this.SESSION_KEY_CRYPTO];

    if (storedKey) {
      // 保存されたキーをインポート
      return await crypto.subtle.importKey(
        'raw',
        new Uint8Array(storedKey),
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }

    // 新しいキーを生成
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // キーをエクスポートして保存
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    await chrome.storage.session.set({
      [this.SESSION_KEY_CRYPTO]: Array.from(new Uint8Array(exportedKey))
    });

    return key;
  }

  /**
   * 暗号化キーを取得
   * @returns {Promise<CryptoKey|null>}
   */
  static async getCryptoKey() {
    const result = await chrome.storage.session.get(this.SESSION_KEY_CRYPTO);
    const storedKey = result[this.SESSION_KEY_CRYPTO];

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
   * パスワードを暗号化
   * @param {string} password
   * @param {CryptoKey} key
   * @returns {Promise<{encrypted: number[], iv: number[]}>}
   */
  static async encryptPassword(password, key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    // 初期化ベクトル(IV)を生成
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    return {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    };
  }

  /**
   * パスワードを復号
   * @param {number[]} encryptedData
   * @param {number[]} iv
   * @param {CryptoKey} key
   * @returns {Promise<string>}
   */
  static async decryptPassword(encryptedData, iv, key) {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(encryptedData)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * 認証情報を保存
   * @param {string} companyCode - 法人コード
   * @param {string} employeeCode - 社員コード
   * @param {string} password - パスワード
   * @returns {Promise<boolean>} 保存成功時はtrue
   */
  static async save(companyCode, employeeCode, password) {
    try {
      // バリデーション
      if (!this.isValidCompanyCode(companyCode)) {
        console.error('[勤労の獅子] 法人コードは5桁以下の数字で入力してください');
        return false;
      }
      if (!this.isValidEmployeeCode(employeeCode)) {
        console.error('[勤労の獅子] 社員コードは10桁以下の数字で入力してください');
        return false;
      }
      if (!password) {
        console.error('[勤労の獅子] パスワードを入力してください');
        return false;
      }

      // 暗号化キーを取得または生成
      const cryptoKey = await this.getOrCreateCryptoKey();

      // パスワードを暗号化
      const { encrypted, iv } = await this.encryptPassword(password, cryptoKey);

      // chrome.storage.local に保存
      await chrome.storage.local.set({
        [this.STORAGE_KEY_COMPANY]: companyCode,
        [this.STORAGE_KEY_EMPLOYEE]: employeeCode,
        [this.STORAGE_KEY_PASSWORD]: encrypted,
        [this.STORAGE_KEY_IV]: iv
      });

      console.log('[勤労の獅子] 認証情報を暗号化して保存しました');
      return true;
    } catch (error) {
      console.error('[勤労の獅子] 認証情報の保存に失敗しました:', error);
      return false;
    }
  }

  /**
   * 認証情報を取得
   * @returns {Promise<{companyCode: string, employeeCode: string, password: string} | null>}
   */
  static async get() {
    try {
      // 暗号化キーを取得(セッションが切れていればnull)
      const cryptoKey = await this.getCryptoKey();

      if (!cryptoKey) {
        console.log('[勤労の獅子] 暗号化キーがありません(ブラウザ再起動後)');
        return null;
      }

      // chrome.storage.local から取得
      const result = await chrome.storage.local.get([
        this.STORAGE_KEY_COMPANY,
        this.STORAGE_KEY_EMPLOYEE,
        this.STORAGE_KEY_PASSWORD,
        this.STORAGE_KEY_IV
      ]);

      const companyCode = result[this.STORAGE_KEY_COMPANY];
      const employeeCode = result[this.STORAGE_KEY_EMPLOYEE];
      const encryptedPassword = result[this.STORAGE_KEY_PASSWORD];
      const iv = result[this.STORAGE_KEY_IV];

      if (!companyCode || !employeeCode || !encryptedPassword || !iv) {
        return null;
      }

      // パスワードを復号
      const password = await this.decryptPassword(encryptedPassword, iv, cryptoKey);

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
   * 設定画面の初期値として使用
   * @returns {Promise<{companyCode: string, employeeCode: string} | null>}
   */
  static async getSavedCodes() {
    try {
      const result = await chrome.storage.local.get([
        this.STORAGE_KEY_COMPANY,
        this.STORAGE_KEY_EMPLOYEE
      ]);

      const companyCode = result[this.STORAGE_KEY_COMPANY];
      const employeeCode = result[this.STORAGE_KEY_EMPLOYEE];

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
   * 認証情報が存在するかチェック
   * @returns {Promise<boolean>}
   */
  static async exists() {
    const credential = await this.get();
    return credential !== null;
  }

  /**
   * 認証情報を削除
   * @returns {Promise<boolean>}
   */
  static async clear() {
    try {
      await chrome.storage.local.remove([
        this.STORAGE_KEY_COMPANY,
        this.STORAGE_KEY_EMPLOYEE,
        this.STORAGE_KEY_PASSWORD,
        this.STORAGE_KEY_IV
      ]);
      await chrome.storage.session.remove(this.SESSION_KEY_CRYPTO);
      console.log('[勤労の獅子] 認証情報を削除しました');
      return true;
    } catch (error) {
      console.error('[勤労の獅子] 認証情報の削除に失敗しました:', error);
      return false;
    }
  }
}
