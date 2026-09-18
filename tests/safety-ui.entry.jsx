import React from 'react';
import AdminReportsPanel from '../components/AdminReportsPanel';
import SignupPage from '../app/signup/page';
import { createRoot } from 'react-dom/client';
import TrustStoreButton from '../components/TrustStoreButton';
import ReportForm from '../components/ReportForm';
import AdminWithdrawalActions from '../components/AdminWithdrawalActions';
import CheckoutSafetyReminder from '../components/CheckoutSafetyReminder';

const mode = new URLSearchParams(location.search).get('mode');
const id='33333333-3333-4333-8333-333333333333';
const reminder={firstPurchase:mode!=='returning',store:{name:'Safety Test Store',storeUrl:'/s/test',deliveryUrl:'/s/test#delivery',refundUrl:'/s/test#refunds'}};
function App(){
 if(mode==='admin-reports')return <AdminReportsPanel/>;
 if(mode==='signup') return <SignupPage searchParams={{role:"customer"}}/>;
 if(mode==='report') return <ReportForm storeId={id} orderId='99999999-9999-4999-8999-999999999999' type='order' />;
 if(mode==='payout') return <AdminWithdrawalActions item={{id, status:'processing',amount:1000,fee:100,payout_amount:900,receipt_path:'private/test-receipt'}} />;
 if(mode==='first'||mode==='returning') return <CheckoutSafetyReminder reminder={reminder} />;
 return <TrustStoreButton storeId={id} initialTrusted={mode==='existing'} />;
}
createRoot(document.getElementById('root')).render(<App/>);
