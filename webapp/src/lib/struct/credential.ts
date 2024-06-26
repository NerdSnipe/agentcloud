'use strict';

export enum CredentialType {
	OPENAI = 'open_ai',
	FASTEMBED = 'fastembed',
	OLLAMA = 'ollama',
}

export const CredentialTypes = Object.values(CredentialType);

interface CredentialRequirements {
    [key: string]: string | boolean; // Key is the field name, value is its type or existence
}

export const CredentialTypeRequirements: Record<CredentialType, CredentialRequirements> = {
	[CredentialType.OPENAI]: {
		base_url: false,
		api_key: false,
	},
	[CredentialType.FASTEMBED]: {
		base_url: false,
		api_key: false,
	},
	[CredentialType.OLLAMA]: {
		base_url: 'string',
		api_key: 'string',
	},
    // Add more types here if needed
};
