import { events } from '@dropins/tools/event-bus.js';
import { initializers } from '@dropins/tools/initializer.js';
import { getHeaders } from '@dropins/tools/lib/aem/configs.js';
import { initialize, setFetchGraphQlHeaders } from '@dropins/storefront-order/api.js';
import { initializeDropin } from './index.js';
import {
  fetchPlaceholders,
  checkIsAuthenticated,
  CUSTOMER_ORDER_DETAILS_PATH,
  ORDER_DETAILS_PATH,
  CUSTOMER_RETURN_DETAILS_PATH,
  RETURN_DETAILS_PATH,
  CUSTOMER_CREATE_RETURN_PATH,
  CREATE_RETURN_PATH,
  CUSTOMER_ORDERS_PATH,
  ORDER_STATUS_PATH,
  CUSTOMER_PATH,
  SALES_GUEST_VIEW_PATH,
  SALES_ORDER_VIEW_PATH,
  rootLink,
} from '../commerce.js';

await initializeDropin(async () => {
  const { pathname, searchParams } = new URL(window.location.href);
  if (pathname.includes(CUSTOMER_ORDERS_PATH)) {
    return;
  }
  const isAccountPage = pathname.includes(CUSTOMER_PATH);
  const orderRef = searchParams.get('orderRef');
  const returnRef = searchParams.get('returnRef');
  const orderNumber = searchParams.get('orderNumber');
  const isTokenProvided = orderRef && orderRef.length > 20;

  setFetchGraphQlHeaders((prev) => ({ ...prev, ...getHeaders('order') }));

  const labels = await fetchPlaceholders('placeholders/order.json');
  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  const pathsRequiringRedirects = [
    ORDER_DETAILS_PATH,
    CUSTOMER_ORDER_DETAILS_PATH,
    RETURN_DETAILS_PATH,
    CUSTOMER_RETURN_DETAILS_PATH,
    CREATE_RETURN_PATH,
    CUSTOMER_CREATE_RETURN_PATH,
    SALES_GUEST_VIEW_PATH,
    SALES_ORDER_VIEW_PATH,
  ];

  if (pathsRequiringRedirects.includes(pathname)) {
    await handleUserOrdersRedirects(
      pathname,
      isAccountPage,
      orderRef,
      returnRef,
      isTokenProvided,
      langDefinitions,
      orderNumber,
    );
    return;
  }

  await initializers.mountImmediately(initialize, {
    langDefinitions,
    orderRef,
    returnRef,
  });
})();

async function handleUserOrdersRedirects(
  pathname,
  isAccountPage,
  orderRef,
  returnRef,
  isTokenProvided,
  langDefinitions,
  orderNumber,
) {
  let targetPath = null;

  events.on('order/error', () => {
    if (checkIsAuthenticated()) {
      window.location.href = rootLink(CUSTOMER_ORDERS_PATH);
    } else if (isTokenProvided) {
      window.location.href = orderNumber ? rootLink(`${ORDER_STATUS_PATH}?orderRef=${orderNumber}`) : rootLink(ORDER_STATUS_PATH);
    } else {
      window.location.href = rootLink(`${ORDER_STATUS_PATH}?orderRef=${orderRef}`);
    }
  });

  if (checkIsAuthenticated()) {
    if (!orderRef) {
      targetPath = CUSTOMER_ORDERS_PATH;
    } else if (isAccountPage) {
      targetPath = isTokenProvided
        ? `${ORDER_DETAILS_PATH}?orderRef=${orderRef}`
        : null;
    } else {
      targetPath = isTokenProvided
        ? null
        : `${CUSTOMER_ORDER_DETAILS_PATH}?orderRef=${orderRef}`;
    }
  } else {
    // XWalk: prevent redirect on author if there is no valid order/token
    // otherwise the page cant be edited eg. return-details, create-return
    // eslint-disable-next-line no-lonely-if
    if (window.xwalk?.isAuthorEnv) {
      targetPath = null;
    } else {
      targetPath = !orderRef ? ORDER_STATUS_PATH : null;
    }
  }

  if (targetPath) {
    window.location.href = rootLink(targetPath);
  } else {
    await initializers.mountImmediately(initialize, {
      langDefinitions,
      orderRef,
      returnRef,
    });
  }
}
