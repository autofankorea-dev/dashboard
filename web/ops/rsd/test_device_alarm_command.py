import copy,struct,unittest
from unittest.mock import patch
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
