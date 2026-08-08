export const developerInfo = {
  name: 'Arpan Patra',
  email: 'thispc119@gmail.com',
  portfolio: 'https://arpan111.vercel.app/',
  description:
    'Arpan Patra is a software developer focused on building practical mobile and web applications, full-stack products, and user-friendly digital tools.',
};

export const isAllowedDeveloperUrl = (url: string): boolean => {
  return url === developerInfo.portfolio || url === `mailto:${developerInfo.email}`;
};
