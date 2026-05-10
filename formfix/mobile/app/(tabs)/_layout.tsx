import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: Icon; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <Ionicons name={name} size={22} color={focused ? Colors.accent : Colors.textMuted} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="search"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" focused={focused} /> }}
      />
      {/* Centre — Camera (index) */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.centerBtn}>
              <View style={styles.centerInner} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} /> }}
      />
      {/* Hidden extra */}
      <Tabs.Screen name="feed" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 0.5,
    height: 80,
    paddingBottom: 12,
  },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  iconActive: { backgroundColor: Colors.card },
  centerBtn: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  centerInner: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.bg,
  },
});
