import { dynamicResponse } from '@dr';
import { getAccountById } from 'db/account';
import { getOrgById } from 'db/org';
import debug from 'debug';
import { PlanLimitsKeys, pricingMatrix, SubscriptionPlan } from 'struct/billing';
const log = debug('webapp:middleware:auth:checksubscription');

const cache = {};

export async function fetchUsage(req, res, next) {

	const currentOrg = res.locals?.matchingOrg;
	const currentTeam = res.locals?.matchingTeam;

	if (!currentOrg || !currentTeam) {
		return dynamicResponse(req, res, 400, { error: 'Missing org or team in usage check' });
	}

	const { stripePlan } = (res.locals?.subscription || {});
	if (!stripePlan) {
		return dynamicResponse(req, res, 400, { error: 'Missing stripe plan in usage check' });
	}

	try {
	
		// Count the number of members in the team
		const teamMembersCount = Object.keys(currentTeam.permissions).length || 0;

		// Add usage data to the response locals
		res.locals.usage = {
			...(res.locals.usage || {}),
			[PlanLimitsKeys.users]: teamMembersCount,
		};

		res.locals.limits = pricingMatrix[stripePlan];

		next();

	} catch (error) {
		log('Error fetching usage:', error);
		return dynamicResponse(req, res, 500, { error: 'Error fetching usage data' });
	}
}

export async function setSubscriptionLocals(req, res, next) {

	let ownerId = res.locals?.matchingOrg?.ownerId;

	if (!ownerId) {
		const currentOrgId = res.locals?.matchingOrg?.id || res.locals?.account?.currentOrg;
		if (!currentOrgId) {
			return dynamicResponse(req, res, 400, { error: 'Missing org in subscription check context' });
		}
		const parentOrg = await getOrgById(currentOrgId);
		if (!parentOrg) {
			return dynamicResponse(req, res, 400, { error: 'Invalid org in subscription check context' });
		}
		const parentOrgOwner = await getAccountById(parentOrg.ownerId);
		if (!parentOrgOwner) {
			return dynamicResponse(req, res, 400, { error: 'Account error' });
		}
		res.locals.subscription = parentOrgOwner.stripe;
		if (res.locals?.account?.stripe) {
			res.locals.account._stripe = res.locals.account.stripe;
			res.locals.account.stripe = parentOrgOwner.stripe; //TODO: think about this some more
		}
	}

	next();

}

export function checkSubscriptionPlan(plans: SubscriptionPlan[]) {
	// @ts-ignore
	return cache[plans] || (cache[plans] = async function(req, res, next) {
		const { stripePlan } = (res.locals?.subscription || {});
		if (!plans.includes(stripePlan)) {
			return dynamicResponse(req, res, 400, { error: `This feature is only available on plans: ${plans.join('\n')}` });
		}
		next();
	});
}

export function checkSubscriptionLimit(limit: keyof typeof PlanLimitsKeys) {
	// @ts-ignore
	return cache[limit] || (cache[limit] = async function(req, res, next) {
		const { stripePlan } = (res.locals?.subscription || {});
		const usage = res.locals.usage||{};
		const limits = res.locals.limits||{};
		log(`plan: ${stripePlan}, limit: ${limit}, usage: ${usage}, usage[limit]: ${usage[limit]}, limits[limit]: ${limits[limit]}`);
		// @ts-ignore
		if ((!usage || !stripePlan)
			|| (usage && stripePlan && usage[limit] >= limits[limit])) {
			return dynamicResponse(req, res, 400, { error: `Usage for "${limit}" exceeded (${usage[limit]}/${res.locals.subscription[limit]}).` });
		}
		next();
	});
}

export function checkSubscriptionBoolean(limit: keyof typeof PlanLimitsKeys) {
	// @ts-ignore
	return cache[limit] || (cache[limit] = async function(req, res, next) {
		const { stripePlan } = (res.locals?.subscription || {});
		const limits = res.locals.limits||{};
		// @ts-ignore
		if (!stripePlan || !limits || limits[limit] !== true) {
			return dynamicResponse(req, res, 400, { error: `Plan does not include feature "${limit}".` });
		}
		next();
	});
}

