
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { supabase } from "../lib/supabase";

type Props = {
  onBack: () => void;
};

export default function MatchmakingTestScreen({
  onBack,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(
    "Ready to test automatic matchmaking."
  );

  async function saveSchedule() {
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "save_my_schedule",
        {
          p_sports: ["tennis"],
          p_slots: [
            {
              day_of_week: 7,
              start_time: "20:00",
              end_time: "21:00",
            },
          ],
        }
      );

      if (error) throw error;

      setResult(
        "SCHEDULE SAVED\n\n" +
          JSON.stringify(data, null, 2)
      );
    } catch (error: any) {
      setResult("ERROR\n\n" + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function runMatching() {
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "run_auto_matchmaking"
      );

      if (error) throw error;

      setResult(
        "MATCHMAKING RESULT\n\n" +
          JSON.stringify(data, null, 2)
      );
    } catch (error: any) {
      setResult("ERROR\n\n" + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>
        Automatic Matchmaking Test
      </Text>

      <Text style={styles.subtitle}>
        Sport: Tennis{"\n"}
        Availability: Sunday, 8–9 PM{"\n"}
        Minimum players: 2
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.disabled,
        ]}
        onPress={saveSchedule}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          1. Save My Schedule
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.disabled,
        ]}
        onPress={runMatching}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          2. Run Auto Matchmaking
        </Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#111827"
          style={styles.loader}
        />
      )}

      <View style={styles.resultBox}>
        <Text selectable style={styles.resultText}>
          {result}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.buttonText}>
          Back to Home
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 18,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 26,
    color: "#374151",
    marginBottom: 28,
  },

  button: {
    backgroundColor: "#16A34A",
    padding: 17,
    borderRadius: 12,
    marginBottom: 14,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  disabled: {
    opacity: 0.5,
  },

  loader: {
    marginTop: 20,
  },

  resultBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 18,
    marginTop: 25,
    minHeight: 120,
  },

  resultText: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 21,
  },

  backButton: {
    backgroundColor: "#222222",
    padding: 17,
    borderRadius: 12,
    marginTop: 35,
  },
});
