# Moesif Apigee Integration

The Moesif integration for [Apigee](https://cloud.google.com/apigee) enables you to get powerful API analytics and monetization capabilities for your Apigee environment. It works by logging API traffic to [Moesif API Analytics and Monetization platform](https://www.moesif.com?language=apigee&utm_medium=docs&utm_campaign=partners&utm_source=apigee). 

With the Moesif plugin for Apigee, you can:

* [Understand customer API usage](https://www.moesif.com/features/api-analytics?utm_medium=docs&utm_campaign=partners&utm_source=apigee)
* [Get alerted on API consumption and issues](https://www.moesif.com/features/api-monitoring?utm_medium=docs&utm_campaign=partners&utm_source=apigee)
* [Monetize APIs with usage-based billing](https://www.moesif.com/solutions/metered-api-billing?utm_medium=docs&utm_campaign=partners&utm_source=apigee)
* [Enforce quotas and limits](https://www.moesif.com/features/api-governance-rules?utm_medium=docs&utm_campaign=partners&utm_source=apigee)
* [Guide customers using your APIs](https://www.moesif.com/features/user-behavioral-emails?utm_medium=docs&utm_campaign=partners&utm_source=apigee)

The integration is a javascript policy which installs within the Apigee console in a few clicks.


## 1. Add a Javascript policy

* Within the Apigee console, go to your API Proxy and click add a policy. 
* Select "Javascript" within the drop down
* Select a file and upload the file [`moesif-api-analytics.js`](https://github.com/Moesif/moesif-apigee/blob/master/moesif-api-analytics.js).

## 2. Configure policy

Within the XML added, define the properties below to add your Moesif Application Id

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Javascript continueOnError="true" enabled="true" timeLimit="200" name="JS-MOESIF">
  <DisplayName>JS-MOESIF-API-ANALYTICS</DisplayName>
  <Properties>
    <Property name="applicationId">Your Moesif Application Id</Property>
    <Property name="logBody">true</Property>
    <Property name="debug">false</Property>
  </Properties>
  <ResourceURL>jsc://moesif-api-analytics.js</ResourceURL>
</Javascript>
```

Your Moesif Application Id can be found in the [_Moesif Portal_](https://www.moesif.com/).
After signing up for a Moesif account, your Moesif Application Id will be displayed during the onboarding steps or by going to API keys section within Moesif settings.

## 3. Enable the Policy

Within _Proxy Endoints_, attach the Moesif policy to the APIs you want monitored by Moesif.

## High Volume APIs

For high volume APIs, it's strongly recommended to leverage Moesif's [secure proxy](https://www.moesif.com/docs/platform/secure-proxy/) to buffer requests. This ensures optimal performance of your API gateway and infrastructure.

## Limitations

This policy has been recently released and still in preview.
Moesif dynamic sampling and governance rules are not yet supported but coming soon.
