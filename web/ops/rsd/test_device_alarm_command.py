import copy,struct,unittest
from unittest.mock import patch
from types import SimpleNamespace
import C
from test_combined_command import ROW,CHANNELS
from wire_command import build_mqtt_message,CommandError
from wire_decode import crc16_ccitt_false
import command_ack as ack

def command(channels=None):
    r=copy.deepcopy(ROW);r['action']='SET_CONTROLLER_SETTINGS'
    r['payload_json']={'command_channels':channels or [],'alarm_settings':{'lowTempC':10,'highTempC':43.6}}
    return r

def live(channels=True):
    r={'stallTyCode':'SP01','stallNo':'01','eqpmnNo':'03','alarmLowTempC':'10','alarmHighTempC':'43.6'}
    if channels:r['channels']=[dict(c,thermo=copy.deepcopy(c)) for c in CHANNELS]
    return r

class DeviceAlarmTests(unittest.TestCase):
    def test_single_mqtt_publication_and_ack_gate(self):
        for flags in (0, 1):
            r=command(CHANNELS)
            if not flags: del r['payload_json']['alarm_settings']
            published=[]
            def publish(topic,body,**kwargs):
                published.append((topic,body))
                return SimpleNamespace(rc=0,wait_for_publish=lambda timeout:None)
            with patch.object(C,'mark_sent') as sent,patch.object(C,'wait_for_applied',return_value='applied') as wait:
                self.assertEqual(C.gate_send_one(SimpleNamespace(publish=publish),r),'applied')
                self.assertEqual(len(published),1)
                self.assertEqual(len(published[0][1]),33)
                self.assertEqual(published[0][1][:2],bytes([14,flags]))
                sent.assert_called_once();wait.assert_called_once()
    def test_fixed_packet_flags_and_masks(self):
        for flags in (0, 1):
            for mask in range(8):
                selected = [c for i,c in enumerate(CHANNELS) if mask & (1 << i)]
                r = command(selected)
                if not flags: del r['payload_json']['alarm_settings']
                if not flags and not mask:
                    with self.assertRaises(CommandError): build_mqtt_message(r)
                    self.assertIsNone(ack.find_thermo_for_command(r, {}))
                    continue
                _, w, p = build_mqtt_message(r)
                self.assertEqual(len(w), 33)
                self.assertEqual(w[:6], bytes([14,flags,1,1,3,mask]))
                self.assertEqual(p['flags'],flags)
                for slot in range(3):
                    if not mask & (1 << slot): self.assertEqual(w[6+slot*7:13+slot*7],b'\xff'*7)
                if not flags:
                    self.assertEqual(w[27:31], b'\xff'*4)
                    self.assertNotIn('alarm_settings', p)
                    # The audit JSON must re-encode to the same packet after C.py stores it.
                    self.assertEqual(build_mqtt_message(dict(r,payload_json=p))[1], w)
                self.assertEqual(struct.unpack('<H',w[31:])[0],crc16_ccitt_false(w[:31]))
    def test_ack_channel_only_ignores_unselected_values(self):
        r=command([CHANNELS[1]]); del r['payload_json']['alarm_settings']
        c=live();c['alarmLowTempC']='bad';c['alarmHighTempC']='99'
        c['channels'][0]['thermo']['setpointTemp']=0
        c['channels'][2]['thermo']['setpointTemp']=0
        self.assertIsNotNone(ack.find_thermo_for_command(r,ack.collect_thermo_from_controllers([c])))
        c['channels'][1]['thermo']['setpointTemp']=0
        self.assertIsNone(ack.find_thermo_for_command(r,ack.collect_thermo_from_controllers([c])))
    def test_invalid_optional_fields(self):
        for payload in ({}, {'command_channels':[]}, {'alarm_settings':None}, {'alarm_settings':None,'command_channels':CHANNELS}, {'command_channels':{}}, {'command_channels':[CHANNELS[0],CHANNELS[0]]}):
            r=command();r['payload_json']=payload
            with self.assertRaises(CommandError): build_mqtt_message(r)
    def test_alarm_only(self):
        topic,w,p=build_mqtt_message(command())
        self.assertEqual(w.hex(),'0e0101010300ffffffffffffffffffffffffffffffffffffffffff6400b4016d54')
        self.assertEqual(len(w),33);self.assertEqual(w[6:27],b'\xff'*21)
        self.assertEqual(struct.unpack('<HH',w[27:31]),(100,436))
        self.assertEqual(struct.unpack('<H',w[31:])[0],crc16_ccitt_false(w[:31]))
        self.assertEqual(p['alarm_settings'],{'lowTempC':10,'highTempC':43.6})
        self.assertEqual(p['wire_ver'],14);self.assertEqual(p['flags'],1)
    def test_combined(self):
        w=build_mqtt_message(command(CHANNELS))[1]
        self.assertEqual(w.hex(),'0e010101030701fa0014000a6402f0000f00145003eb001e001e5a6400b4012dcc')
    def test_invalid(self):
        for lo,hi in ((10,10),(-1,20),(10,101),(10.05,20),(float('nan'),20),('10',20)):
            r=command();r['payload_json']['alarm_settings']={'lowTempC':lo,'highTempC':hi}
            with self.assertRaises(CommandError):build_mqtt_message(r)
    def test_ack_alarm_only(self):
        for channels in (True,False):
            c=live(channels);values=ack.collect_thermo_from_controllers([c])
            self.assertIsNotNone(ack.find_thermo_for_command(command(),values))
            c['alarmHighTempC']='40';self.assertIsNone(ack.find_thermo_for_command(command(),ack.collect_thermo_from_controllers([c])))
        c=live();del c['alarmLowTempC'];self.assertIsNone(ack.find_thermo_for_command(command(),ack.collect_thermo_from_controllers([c])))
    def test_ack_all_selected_channels_and_alarms(self):
        c=live();r=command(CHANNELS)
        self.assertIsNotNone(ack.find_thermo_for_command(r,ack.collect_thermo_from_controllers([c])))
        c['channels'][2]['thermo']['setpointTemp']=20
        self.assertIsNone(ack.find_thermo_for_command(r,ack.collect_thermo_from_controllers([c])))
    def test_stale_uplink_rejected(self):
        r=command();r.update(status='sent',sent_at='2026-10-07T00:00:00Z')
        d={'mode':'live','lsind_regist_no':'TEST','item_code':'P00','module_uid':1,'received_at':'2026-10-06T23:59:59Z','decoded_json':{'controllers':[live()]}}
        with patch.object(ack,'SUPABASE_URL','offline'),patch.object(ack,'SUPABASE_SERVICE_ROLE_KEY','offline'),patch.object(ack,'fetch_sent_commands',return_value=[r]),patch.object(ack,'mark_applied') as mark:
            self.assertEqual(ack.try_mark_applied_from_decoded(d),0);mark.assert_not_called()
            d['received_at']='2026-10-07T00:00:01Z'
            self.assertEqual(ack.try_mark_applied_from_decoded(d),1);mark.assert_called_once()
if __name__=='__main__':unittest.main()
