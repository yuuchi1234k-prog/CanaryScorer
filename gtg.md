# Obsidian API 1.11.4+ Secret Storage Feature - Developer Documentation

## 1. Introduction and Overview

The Secret Storage feature introduced in Obsidian API version 1.11.4 provides a secure mechanism for storing sensitive data such as API keys, tokens, and passwords within Obsidian plugins. This feature addresses significant security concerns associated with storing secrets in plaintext within the traditional `data.json` file used by Obsidian plugins. Prior to this feature, developers had no secure alternative for storing sensitive credentials, forcing them to either store secrets in plaintext alongside other plugin settings or implement their own encryption solutions, which often introduced security vulnerabilities.

The Secret Storage API offers a centralized key-value store that allows users to manage their secrets in one location and share them across multiple plugins. This approach eliminates the need for users to copy the same API key into every plugin that requires it, reducing both the cognitive burden on users and the risk of credential exposure. When users update a token, they need only update it in one location, and all plugins using that secret will automatically have access to the updated value.

The Secret Storage feature is built upon Obsidian's vault encryption system, ensuring that secrets are encrypted on disk and only decrypted in memory when requested by an authorized plugin. This architecture provides a robust security foundation that protects sensitive credentials even if the vault files are accessed without authorization. The feature is available on both desktop and mobile platforms, though users must have their vault properly set up with encryption for the functionality to be fully operational.

### 1.1 Version Requirements and Compatibility

The Secret Storage feature was introduced incrementally across several API versions, with the core functionality becoming available in version 1.11.4. The `SecretComponent` UI class was introduced slightly earlier in version 1.11.1, providing the foundation for secure input handling in plugin settings before the full storage API was available. Plugins targeting this feature should declare a minimum Obsidian API version of 1.11.4 in their manifest to ensure all required methods are available at runtime. Developers should always perform version checking before accessing Secret Storage methods to maintain backward compatibility with users who may be running older versions of Obsidian.

The `BaseComponent` class, which serves as the foundation for all UI components including `SecretComponent`, has been available since version 0.10.3 and provides core functionality such as the `disabled` property and the `then()` method for chaining operations. The `setDisabled()` method was added to `BaseComponent` in version 1.2.3, and this method is inherited by `SecretComponent`. Understanding these version relationships is essential for developers who need to support older Obsidian versions while leveraging newer features.

---

## 2. SecretStorage Interface Reference

The `SecretStorage` class provides the core programmatic interface for storing and retrieving secrets within Obsidian plugins. This class is accessed through the Obsidian application instance via `app.secretStorage`, giving plugins a centralized mechanism for managing sensitive credentials. All methods in the `SecretStorage` class operate synchronously, returning immediate values rather than Promises, which distinguishes it from many other Obsidian API interfaces that utilize asynchronous operations.

### 2.1 Interface Definition

The `SecretStorage` class is exported as a class definition in the Obsidian TypeScript API, providing type safety and IntelliSense support for developers working in TypeScript-enabled development environments. The class serves as a container for the three fundamental operations that plugins can perform with the secret storage system: retrieving stored secrets, listing all available secrets, and storing new secrets. Each of these operations is designed to be straightforward and intuitive, allowing developers to quickly integrate secret storage into their plugins without extensive boilerplate code.

The class design follows a simple key-value store paradigm, where each secret is identified by a unique string ID that plugins use to reference the secret in subsequent operations. This ID-based approach allows multiple plugins to reference the same secret by using identical identifiers, enabling the shared secret model that is central to the Secret Storage feature's value proposition. The implementation ensures that secrets are properly isolated per vault, meaning that secrets stored in one Obsidian vault cannot be accessed from another, even on the same device.

### 2.2 getSecret Method

**Method Signature:**
```typescript
getSecret(id: string): string | null
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The unique identifier of the secret to retrieve |

**Returns:** `string | null` - The secret value associated with the provided ID, or `null` if no secret with that ID exists.

The `getSecret()` method retrieves a previously stored secret from the vault's secure storage. This method takes a single parameter representing the unique identifier of the secret to retrieve. If a secret with the specified ID exists and the user has authorized access, the method its returns the secret value as a string. If no secret with that ID exists, the method returns `null`, allowing plugins to handle missing secrets gracefully without throwing exceptions.

Developers should always check for `null` return values before attempting to use the retrieved secret, as this is a normal and expected outcome when a secret has not yet been configured by the user. The recommended pattern is to use optional chaining or explicit null checks before accessing the secret value in subsequent operations. This approach prevents type errors and allows plugins to provide appropriate user feedback when required secrets are missing.

**Usage Example:**
```typescript
async function fetchSecureData(plugin: MyPlugin): Promise<void> {
  const apiKey = plugin.app.secretStorage.getSecret('openai-api-key');
  
  if (!apiKey) {
    console.log('API key not configured. Please set it in settings.');
    return;
  }
  
  // Use the retrieved secret for authenticated requests
  const response = await fetch('https://api.example.com/data', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  // Process response...
}
```

### 2.3 setSecret Method

**Method Signature:**
```typescript
setSecret(id: string, secret: string): void
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Lowercase alphanumeric ID with optional dashes |
| `secret` | `string` | The secret value to store |

**Returns:** `void`

**Throws:** `Error` if the provided ID is invalid

The `setSecret()` method stores a new secret or updates an existing secret in the vault's secure storage. The method takes two parameters: the unique identifier for the secret and the value to be stored. Unlike `getSecret()`, this method does not return a value, as the operation is guaranteed to succeed when called with valid parameters. If an invalid ID format is provided, the method will throw an error, which plugins should catch and handle appropriately.

The ID parameter must follow specific formatting requirements: it must be a lowercase alphanumeric string that may include dashes as separators. This restriction ensures consistent naming conventions across plugins and prevents ID collisions that could arise from case sensitivity issues or special character usage. Developers should establish a clear naming convention for their secrets, typically incorporating the plugin name or purpose as a prefix to avoid conflicts with other plugins.

Secret values are stored using Obsidian's vault encryption system, which ensures that the data is encrypted on disk and remains protected even if the vault files are accessed without authorization. The encryption is tied to the specific vault, meaning secrets cannot be transferred between vaults without proper export procedures. This design provides strong security guarantees while maintaining usability for the end user.

**Usage Example:**
```typescript
async function saveApiKey(plugin: MyPlugin, key: string): Promise<void> {
  try {
    // Validate and store the secret
    plugin.app.secretStorage.setSecret('weather-api-key', key);
    console.log('API key saved successfully');
  } catch (error) {
    console.error('Failed to save API key:', error.message);
  }
}
```

### 2.4 listSecrets Method

**Method Signature:**
```typescript
listSecrets(): string[]
```

**Parameters:** None

**Returns:** `string[]` - An array containing the IDs of all secrets currently stored in the vault

The `listSecrets()` method provides a way to discover all secrets that have been stored in the vault's secret storage. This method takes no parameters and returns an array of strings representing the IDs of all available secrets. This functionality is particularly useful for plugins that need to display a list of available secrets for user selection, such as when implementing a dropdown for secret selection in settings.

The returned array includes secrets from all plugins and user-created secrets, enabling the shared secret model that is central to the feature's design. Plugins can use this method to present users with existing secrets they might want to use, reducing friction in the configuration process. However, plugins should not assume they have write access to all listed secrets, as some may belong to other plugins or represent system-level credentials.

**Usage Example:**
```typescript
function displayAvailableSecrets(app: App): void {
  const availableSecrets = app.secretStorage.listSecrets();
  
  if (availableSecrets.length === 0) {
    console.log('No secrets have been stored in this vault.');
    return;
  }
  
  console.log('Available secrets:');
  availableSecrets.forEach(secretId => {
    console.log(`  - ${secretId}`);
  });
}
```

---

## 3. SecretComponent UI Component Reference

The `SecretComponent` class provides a specialized UI component for handling secret and password inputs within Obsidian plugin settings tabs. This component extends the base UI component architecture to provide built-in functionality for securely inputting sensitive values such as API keys, tokens, and passwords. The component handles the complexity of connecting user input to the underlying Secret Storage API, providing a seamless experience for both developers implementing the component and users configuring their plugins.

### 3.1 Class Hierarchy and Inheritance

**Available since:** 1.11.1

**Class Hierarchy:**
```
BaseComponent → SecretComponent
```

The `SecretComponent` class inherits from `BaseComponent`, which serves as the abstract foundation for all UI components in the Obsidian API. This inheritance provides several important capabilities that `SecretComponent` leverages. The `disabled` property, available since version 0.10.3, allows developers to disable the component's input field, preventing user interaction when necessary. The `setDisabled()` method, added in version 1.2.3, provides a fluent interface for modifying this property. Additionally, the `then()` method, available since version 0.9.7, enables method chaining for more concise component configuration.

Understanding this inheritance hierarchy is important for developers who need to implement custom behavior or extend the component's functionality. The protected nature of the base class members means that while developers can set the disabled state and chain method calls, they cannot directly access or modify the internal implementation details of how the component manages its state. This encapsulation ensures consistent behavior across all components while allowing for specialized subclasses like `SecretComponent`.

### 3.2 Constructor

**Constructor Signature:**
```typescript
constructor(app: App, containerEl: HTMLElement)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `app` | `App` | The Obsidian application instance |
| `containerEl` | `HTMLElement` | The DOM element to attach the component to |

The constructor for `SecretComponent` takes two parameters: the Obsidian application instance and a DOM container element. The application instance is essential because the `SecretComponent` requires access to the Secret Storage API, which is accessed through `app.secretStorage`. This is a key difference from standard text input components, which do not require the application instance for their basic functionality.

The container element parameter specifies where in the DOM the component's input field should be rendered. This element is typically provided by the `Setting` component's callback when using the `addComponent()` method, which is the recommended approach for adding `SecretComponent` to a settings tab. The component will append its input field as a child of this container element, managing its own lifecycle and cleanup when the settings tab is destroyed.

### 3.3 Methods

#### setValue Method

**Available since:** 1.11.4

**Method Signature:**
```typescript
setValue(value: string): SecretComponent
```

**Parameters:**
- `value: string` - The value to set in the input field

**Returns:** `SecretComponent` - The component instance for chaining

The `setValue()` method sets the current value displayed in the secret input field. This method is particularly useful when loading previously saved settings from the plugin's configuration, allowing the component to reflect the current state when the settings tab is displayed. The method returns the component instance, enabling method chaining with other configuration methods such as `onChange()`.

**Usage Example:**
```typescript
new Setting(containerEl)
  .setName('API Token')
  .setDesc('Enter your API token for authentication')
  .addComponent(el => {
    new SecretComponent(this.app, el)
      .setValue(this.plugin.settings.apiToken || '')
      .onChange(async (value) => {
        this.plugin.settings.apiToken = value;
        await this.plugin.saveSettings();
      });
  });
```

#### onChange Method

**Available since:** 1.11.4

**Method Signature:**
```typescript
onChange(callback: (value: string) => void): SecretComponent
```

**Parameters:**
- `callback: (value: string) => void` - Function called when the input value changes

**Returns:** `SecretComponent` - The component instance for chaining

The `onChange()` method registers a callback function that is invoked whenever the user modifies the value in the secret input field. The callback receives the current value as its only argument, allowing the plugin to respond immediately to user input. This method is essential for implementing the reactive pattern where settings changes are captured and saved as they occur.

The callback executes with the current value, not the previous value, which means plugins should always use the value passed to the callback rather than attempting to read the component's value property. This ensures that the callback receives the most recent user input and handles cases where the user may have modified the value multiple times in quick succession.

**Usage Example:**
```typescript
new Setting(containerEl)
  .setName('Personal Access Token')
  .setDesc('Your token for accessing the remote API')
  .addComponent(el => {
    new SecretComponent(this.app, el)
      .setValue(this.plugin.settings.pat)
      .onChange(async (newValue) => {
        // Update settings immediately
        this.plugin.settings.pat = newValue;
        
        // Persist to storage
        await this.plugin.saveSettings();
        
        // Validate the new token
        await this.validateToken(newValue);
      });
  });
```

#### setDisabled Method (Inherited)

**Available since:** 1.2.3 (inherited from BaseComponent)

**Method Signature:**
```typescript
setDisabled(disabled: boolean): SecretComponent
```

**Parameters:**
- `disabled: boolean` - Whether the component should be disabled

**Returns:** `SecretComponent` - The component instance for chaining

The `setDisabled()` method controls whether the secret input field is interactive. When set to `true`, the input field becomes read-only and the user cannot modify its contents. Visual feedback indicating the disabled state is automatically applied by the component. This method is inherited from `BaseComponent` and works identically across all UI components.

**Usage Example:**
```typescript
new Setting(containerEl)
  .setName('Service Account Key')
  .addComponent(el => {
    const component = new SecretComponent(this.app, el)
      .setValue(this.plugin.settings.serviceKey)
      .onChange(async (value) => {
        this.plugin.settings.serviceKey = value;
        await this.plugin.saveSettings();
      });
    
    // Disable during network operations
    if (this.plugin.isValidating) {
      component.setDisabled(true);
    }
    
    return component;
  });
```

#### then Method (Inherited)

**Available since:** 0.9.7 (inherited from BaseComponent)

**Method Signature:**
```typescript
then<T>(callback: (component: SecretComponent) => T): T
```

**Parameters:**
- `callback: (component: SecretComponent) => T` - Function to execute with the component

**Returns:** `T` - The result of the callback function

The `then()` method facilitates method chaining by executing a callback function with the component instance and returning its result. This method is particularly useful in functional programming patterns where the component needs to be passed to another function for configuration or processing. While most developers will use the more common `setDisabled()` chaining pattern, `then()` provides flexibility for more complex configuration scenarios.

---

## 4. BaseComponent Foundation Class

The `BaseComponent` class serves as the abstract foundation for all UI components in the Obsidian plugin API. Understanding this base class is essential for developers who want to understand the common capabilities shared by all components, including `SecretComponent`, and how to leverage inherited functionality effectively.

### 4.1 Class Definition

**Available since:** 0.10.3

**Class Signature:**
```typescript
export abstract class BaseComponent
```

`BaseComponent` is an abstract class, meaning it cannot be instantiated directly but instead serves as a blueprint for concrete component implementations. The abstract nature of this class reflects its role as a foundation that provides common functionality while delegating component-specific behavior to subclasses. All visual and interactive components in Obsidian plugins ultimately inherit from this class, creating a consistent interface across the component ecosystem.

### 4.2 Properties

#### disabled Property

**Type:** `boolean`

**Available since:** 0.10.3

The `disabled` property indicates whether the component is in a disabled state where user interaction is prevented. When set to `true`, the component's visual appearance changes to indicate the disabled state, and any associated input mechanisms become non-functional. This property is shared across all component types, providing a uniform way to control component interactivity throughout the Obsidian UI.

The disabled state is particularly useful for implementing conditional workflows where certain inputs should not be accessible under specific circumstances. For example, a plugin might disable its API key input field while validating the entered key, re-enabling it once validation completes. This prevents users from modifying settings during sensitive operations and provides clear visual feedback about the component's current state.

### 4.3 Methods

#### setDisabled Method

**Method Signature:**
```typescript
setDisabled(disabled: boolean): this
```

**Available since:** 1.2.3

The `setDisabled()` method provides a fluent interface for modifying the component's disabled state. The method returns the component instance (`this`), enabling method chaining where multiple configuration calls can be combined into a single expression. This pattern is extensively used throughout the Obsidian API to create concise and readable component configuration code.

The method modifies the underlying `disabled` property and applies any necessary visual changes to reflect the new state. When a component is disabled, it typically displays with reduced opacity and prevents focus and input events from being processed. The exact visual treatment may vary slightly between component types but maintains a consistent user experience across the interface.

#### then Method

**Method Signature:**
```typescript
then<T>(callback: (component: this) => T): T
```

**Available since:** 0.9.7

The `then()` method enables functional composition patterns by passing the component to a callback function and returning its result. This method is particularly useful when integrating with reactive frameworks or when performing complex configuration that requires passing the component to another function. The generic type parameter `T` preserves the return type of the callback, enabling type-safe composition.

### 4.4 Component Types Extending BaseComponent

The following component types all inherit from `BaseComponent` and therefore share the `disabled` property, `setDisabled()` method, and `then()` method:

| Component Type | Description |
|----------------|-------------|
| `AbstractTextComponent` | Base class for text-based input components |
| `ButtonComponent` | Interactive button elements |
| `ColorComponent` | Color picker input |
| `DropdownComponent` | Select dropdown menus |
| `ExtraButtonComponent` | Additional button functionality |
| `MomentFormatComponent` | Date/time formatting controls |
| `ProgressBarComponent` | Progress visualization |
| `SearchComponent` | Search input functionality |
| `SecretComponent` | Secure password/secret input |
| `SliderComponent` | Numeric slider controls |
| `TextAreaComponent` | Multi-line text input |
| `TextComponent` | Single-line text input |
| `ToggleComponent` | On/off toggle switches |
| `ValueComponent` | Generic value display components |

This comprehensive list demonstrates the breadth of the component architecture and the consistent interface provided by `BaseComponent` across all UI element types.

---

## 5. Implementation Guide for Plugin Developers

This section provides a comprehensive guide for implementing Secret Storage in Obsidian plugins, covering best practices, security considerations, and complete code examples that can be adapted for production use.

### 5.1 Why Use SecretStorage

Before implementing Secret Storage, developers should understand the problems this feature solves and why it represents a significant improvement over previous approaches.

**Problems with storing secrets in `data.json`:**

The traditional approach of storing sensitive data in the plugin's `data.json` file presents several serious security vulnerabilities. Secrets stored in this manner are stored in plaintext alongside all other plugin configuration data, meaning that anyone with file access to the vault can read the secrets without any additional authentication. This is particularly concerning for shared vaults or when vault files are synchronized through cloud services, as the secrets become part of the synced data without additional encryption protection.

Furthermore, the `data.json` approach requires each plugin to maintain its own copy of shared credentials. If a user employs the same API key across multiple plugins, they must enter that key into each plugin's settings separately. When the key needs to be updated—such as when a service rotates credentials for security reasons—the user must update every plugin individually. This creates friction in the user experience and increases the likelihood of errors or forgotten credentials.

**Benefits of the SecretStorage solution:**

SecretStorage addresses these problems by providing a centralized, encrypted storage location for credentials. Secrets are stored using the vault's encryption system, which means they are protected by the same encryption that secures the rest of the vault. When users update a secret in the central store, all plugins that reference that secret automatically have access to the updated value without any additional configuration.

The shared secret model also reduces the cognitive burden on users, as they need only remember where they stored each credential rather than which plugin has which key. Plugins can present users with dropdown lists of available secrets, further reducing the potential for errors in credential configuration.

### 5.2 Implementation Pattern

The recommended pattern for implementing Secret Storage in plugins involves three key elements: using `SecretComponent` for input, storing only secret names (not values) in plugin settings, and retrieving the actual secret value programmatically when needed.

**Step 1: Define the settings interface to store secret names, not values**

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
  // Store the name/ID of the secret, not the value itself
  apiKeyName: string;
  modelSelection: string;
}
```

**Step 2: Implement the settings tab with SecretComponent**

```typescript
import { App, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import MyPlugin from "./main";

export class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'API Configuration' });

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Select or enter a secret name for your API key')
      .addComponent(el => {
        new SecretComponent(this.app, el)
          .setValue(this.plugin.settings.apiKeyName || '')
          .onChange(async (value) => {
            this.plugin.settings.apiKeyName = value;
            await this.plugin.saveSettings();
          });
      });

    // Display existing secrets for reference
    const secrets = this.app.secretStorage.listSecrets();
    if (secrets.length > 0) {
      new Setting(containerEl)
        .setName('Available secrets in vault')
        .setDesc(secrets.join(', ') || 'No secrets configured');
    }
  }
}
```

**Step 3: Retrieve the actual secret value when needed**

```typescript
async function executeApiRequest(plugin: MyPlugin): Promise<void> {
  // Get the secret name from settings
  const secretName = plugin.settings.apiKeyName;
  
  if (!secretName) {
    throw new Error('API key not configured. Please select a secret in settings.');
  }
  
  // Retrieve the actual secret value
  const apiKey = plugin.app.secretStorage.getSecret(secretName);
  
  if (!apiKey) {
    throw new Error(`Secret "${secretName}" not found in vault. Please create it in the Obsidian core secrets settings.`);
  }
  
  // Use the retrieved secret for the API request
  const response = await fetch('https://api.example.com/endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ /* request data */ })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  return response.json();
}
```

### 5.3 Understanding the addComponent Pattern

A common point of confusion for developers implementing `SecretComponent` is why it must be added using the `addComponent()` method rather than the simpler `addText()` method available for standard text inputs.

**Why `addComponent` is required:**

The `SecretComponent` requires the `App` instance to access the Secret Storage API. Standard methods like `addText()` create components without access to the `App` instance in their callbacks. The `Setting#addComponent()` method provides full control over component instantiation, allowing developers to pass the required `App` reference to the constructor.

The `addText()` method and similar shortcuts are designed for simple input types that don't require additional dependencies beyond the container element. `SecretComponent`'s need for the `App` instance necessitates the more explicit `addComponent()` pattern, which provides complete flexibility in how components are created and configured.

**Comparison:**

```typescript
// Standard text input - no App instance needed
new Setting(containerEl)
  .setName('Setting name')
  .addText(text => text
    .setValue(this.plugin.settings.someValue)
    .onChange(value => { /* handle change */ })
  );

// Secret component - App instance required
new Setting(containerEl)
  .setName('Secret name')
  .addComponent(el => {
    new SecretComponent(this.app, el)
      .setValue(this.plugin.settings.secretName)
      .onChange(value => { /* handle change */ })
  });
```

### 5.4 Security Best Practices

When implementing Secret Storage in plugins, developers should adhere to several security best practices to ensure the protection of user credentials.

**Store only secret names in plugin settings:**

Plugin settings should contain only the identifier of a secret, never the secret value itself. This separation of concerns ensures that even if plugin settings are compromised, the actual credentials remain protected by the vault's encryption system. The settings file is not encrypted, so storing secret values there would defeat the purpose of using Secret Storage.

**Always validate secret retrieval:**

Before using a retrieved secret, always verify that it exists and contains a value. The `getSecret()` method returns `null` when a secret is not found, and plugins should handle this case gracefully by providing clear user feedback rather than failing silently or with cryptic errors.

```typescript
const apiKey = this.app.secretStorage.getSecret(settings.apiKeyName);
if (!apiKey) {
  this.showNotice('API key not found. Please configure it in settings.');
  return;
}
```

**Never log secrets to console:**

During development and debugging, never log secret values to the console or write them to files. Even temporary debugging statements can expose credentials in development environments or logs. If debugging output is needed, log only the secret ID or length, never the actual value.

**Consider the user's perspective:**

When implementing secret selection, consider providing a list of available secrets using `listSecrets()` so users can select from existing credentials rather than typing names manually. This reduces errors and improves the user experience significantly.

```typescript
// Suggest existing secrets when the user is configuring the plugin
const existingSecrets = this.app.secretStorage.listSecrets();
if (existingSecrets.length > 0) {
  new Setting(containerEl)
    .setName('Available secrets')
    .setDesc(existingSecrets.join(', '));
}
```

---

## 6. Complete Integration Example

The following example demonstrates a complete integration of Secret Storage in a hypothetical Obsidian plugin, including settings tab implementation, secret retrieval, and proper error handling.

### 6.1 Main Plugin File

```typescript
import { Plugin } from 'obsidian';
import { MyPluginSettings, DEFAULT_SETTINGS } from './settings';
import { ApiService } from './api-service';
import { MyPluginSettingTab } from './setting-tab';

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;
  apiService: ApiService;

  async onload(): Promise<void> {
    // Load settings
    await this.loadSettings();

    // Initialize API service with secret retrieval capability
    this.apiService = new ApiService(this);

    // Add settings tab
    this.addSettingTab(new MyPluginSettingTab(this.app, this));

    // Add commands or other plugin functionality
    this.addCommand({
      id: 'execute-with-secret',
      name: 'Execute with API Secret',
      callback: () => this.executeWithSecret(),
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async executeWithSecret(): Promise<void> {
    try {
      const result = await this.apiService.executeRequest();
      console.log('Request successful:', result);
    } catch (error) {
      console.error('Request failed:', error.message);
      // Show user-friendly error notification
      this.showNotice(`Error: ${error.message}`);
    }
  }

  onunload(): void {
    // Cleanup if necessary
  }
}
```

### 6.2 Settings Definition

```typescript
export interface MyPluginSettings {
  apiSecretName: string;
  modelId: string;
  maxTokens: number;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
  apiSecretName: '',
  modelId: 'gpt-4',
  maxTokens: 1000,
};
```

### 6.3 API Service with Secret Handling

```typescript
import MyPlugin from './main';

export class ApiService {
  private plugin: MyPlugin;

  constructor(plugin: MyPlugin) {
    this.plugin = plugin;
  }

  async executeRequest(): Promise<any> {
    const secretName = this.plugin.settings.apiSecretName;

    if (!secretName) {
      throw new Error(
        'API secret not configured. ' +
        'Please select a secret in the plugin settings.'
      );
    }

    // Retrieve the actual secret value
    const apiKey = this.plugin.app.secretStorage.getSecret(secretName);

    if (!apiKey) {
      throw new Error(
        `Secret "${secretName}" not found. ` +
        'Please create it in the Obsidian secrets settings.'
      );
    }

    // Validate that the secret has content
    if (apiKey.trim().length === 0) {
      throw new Error(
        `Secret "${secretName}" is empty. ` +
        'Please enter a valid API key.'
      );
    }

    // Proceed with the API request using the retrieved secret
    return this.makeApiCall(apiKey);
  }

  private async makeApiCall(apiKey: string): Promise<any> {
    // Implementation of actual API call using the retrieved secret
    const response = await fetch('https://api.example.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.plugin.settings.modelId,
        max_tokens: this.plugin.settings.maxTokens,
        prompt: 'Example prompt',
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### 6.4 Settings Tab with SecretComponent

```typescript
import { App, PluginSettingTab, Setting, SecretComponent } from 'obsidian';
import MyPlugin from './main';

export class MyPluginSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'My Plugin Settings' });

    // API Secret Configuration
    new Setting(containerEl)
      .setName('API Secret')
      .setDesc('Enter the name of your API key secret')
      .addComponent(el => {
        new SecretComponent(this.app, el)
          .setValue(this.plugin.settings.apiSecretName)
          .onChange(async (value) => {
            this.plugin.settings.apiSecretName = value;
            await this.plugin.saveSettings();
          });
      });

    // Display available secrets for user reference
    this.displayAvailableSecrets(containerEl);

    // Other settings...
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select the model to use')
      .addText(text => text
        .setValue(this.plugin.settings.modelId)
        .onChange(async (value) => {
          this.plugin.settings.modelId = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Max Tokens')
      .setDesc('Maximum number of tokens for the response')
      .addText(text => text
        .setValue(this.plugin.settings.maxTokens.toString())
        .onChange(async (value) => {
          this.plugin.settings.maxTokens = parseInt(value, 10) || 1000;
          await this.plugin.saveSettings();
        }));
  }

  private displayAvailableSecrets(containerEl: HTMLElement): void {
    const secrets = this.app.secretStorage.listSecrets();
    
    if (secrets.length > 0) {
      new Setting(containerEl)
        .setName('Available Secrets')
        .setDesc(secrets.join(', '));
    } else {
      new Setting(containerEl)
        .setName('No Secrets Configured')
        .setDesc('Create secrets in Obsidian core settings to use them here.');
    }
  }
}
```

---

## 7. Frequently Asked Questions

**How does Secret Storage differ from regular plugin data storage?**

Secret Storage uses the vault's encryption system to protect sensitive values, whereas regular plugin data in `data.json` is stored in plaintext. Secrets stored in Secret Storage are encrypted on disk and only decrypted in memory when explicitly requested. This provides significantly stronger protection for credentials and other sensitive data that should not be accessible without authentication.

**Can multiple plugins access the same secret?**

Yes, multiple plugins can access the same secret by using the same secret ID. This is the intended shared secret model that Secret Storage was designed to support. Users can create a single secret (such as an OpenAI API key) and any plugin that needs that key can reference it by name, eliminating the need to enter the same key into multiple plugins.

**What happens if a user deletes a secret that plugins are using?**

When a secret is deleted from Secret Storage, calls to `getSecret()` for that ID will return `null`. Plugins should handle this case gracefully by checking for null returns and providing appropriate user feedback. This is one reason why storing only the secret name in plugin settings is important—it allows plugins to detect missing secrets and guide users toward resolution.

**Is Secret Storage available on mobile devices?**

Yes, Secret Storage is available on both desktop and mobile versions of Obsidian. However, the setup and management of secrets may differ slightly between platforms depending on the Obsidian version. Users must have their vault properly configured with encryption for Secret Storage to function correctly.

**How should secret IDs be formatted?**

Secret IDs must be lowercase alphanumeric strings with optional dashes. For example, `openai-api-key` and `weather-service-token` are valid IDs, while `OpenAI-API-Key` and `my secret!` are not. Using a consistent naming convention that includes your plugin name or organization identifier is recommended to avoid conflicts with other plugins.

---

## 8. API Reference Summary

### SecretStorage Methods

| Method | Signature | Returns | Available Since |
|--------|-----------|---------|-----------------|
| `getSecret` | `getSecret(id: string): string \| null` | The secret value or null | 1.11.4 |
| `setSecret` | `setSecret(id: string, secret: string): void` | void | 1.11.4 |
| `listSecrets` | `listSecrets(): string[]` | Array of secret IDs | 1.11.4 |

### SecretComponent Methods

| Method | Signature | Returns | Available Since |
|--------|-----------|---------|-----------------|
| `setValue` | `setValue(value: string): SecretComponent` | Self for chaining | 1.11.4 |
| `onChange` | `onChange(cb: (value: string) => void): SecretComponent` | Self for chaining | 1.11.4 |
| `setDisabled` | `setDisabled(disabled: boolean): SecretComponent` | Self for chaining | 1.2.3 |
| `then` | `then<T>(cb: (c: SecretComponent) => T): T` | Callback result | 0.9.7 |

### BaseComponent Methods and Properties

| Member | Type | Returns | Available Since |
|--------|------|---------|-----------------|
| `disabled` | Property (boolean) | - | 0.10.3 |
| `setDisabled` | Method | Self for chaining | 1.2.3 |
| `then` | Method | Callback result | 0.9.7 |

---
