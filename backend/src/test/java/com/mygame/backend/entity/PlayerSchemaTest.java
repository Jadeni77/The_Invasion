package com.mygame.backend.entity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What a person reads when they open the database.
 *
 * These tables are generated from the entity's mappings, so a missing
 * annotation shows up as a column named after its own table and nothing else -
 * `level_stars (player_id, level_stars)` was a bag of star counts with no level
 * attached to any of them.
 *
 * That one was more than untidy. The game reads `levelStars[level - 1]`, so the
 * POSITION is the level, and without an order column nothing stored the
 * position. SQL never promised to return the rows in insertion order; it held
 * only because Postgres usually scans the heap in that order, which stops being
 * true after updates, vacuums or a parallel scan.
 *
 * Asserted against the schema the mappings actually produce, not against the
 * source text that asks for it.
 */
@SpringBootTest
class PlayerSchemaTest {

    @Autowired
    private DataSource dataSource;

    /** Column names of `table`, lower-cased, in declaration order. */
    private List<String> columnsOf(String table) {
        List<String> columns = new ArrayList<>();
        try (Connection connection = dataSource.getConnection();
             ResultSet rs = connection.getMetaData().getColumns(null, null, table.toUpperCase(Locale.ROOT), null)) {
            while (rs.next()) {
                columns.add(rs.getString("COLUMN_NAME").toLowerCase(Locale.ROOT));
            }
        } catch (Exception e) {
            throw new IllegalStateException("could not read the schema for " + table, e);
        }
        return columns;
    }

    @Test
    void readsARealSchema() {
        assertThat(columnsOf("players")).contains("email", "display_name");
    }

    /**
     * The one with a correctness stake: which level a score belongs to has to be
     * stored, not inferred from the order rows happen to come back in.
     */
    @Test
    void recordsWhichLevelEachStarScoreIsFor() {
        assertThat(columnsOf("level_stars"))
                .as("stars with no level attached are just loose numbers")
                .contains("level_index", "stars");
    }

    @Test
    void doesNotNameAColumnAfterItsOwnTable() {
        // The default Hibernate picks when no @Column is given, and the reason
        // every one of these tables read as a column of unexplained values.
        for (String table : List.of("level_stars", "completed_levels", "unlocked_levels",
                                    "claimed_achievements", "special_achievements")) {
            assertThat(columnsOf(table))
                    .as("%s carries a column named after the table", table)
                    .doesNotContain(table);
        }
    }

    @Test
    void saysWhatTheLevelCollectionsHold() {
        assertThat(columnsOf("completed_levels")).contains("level_number");
        assertThat(columnsOf("unlocked_levels")).contains("level_number");
    }

    @Test
    void saysWhatTheAchievementAndTreasureCollectionsHold() {
        assertThat(columnsOf("claimed_achievements")).contains("achievement_id");
        assertThat(columnsOf("special_achievements")).contains("achievement_id");
        assertThat(columnsOf("player_collected_treasures")).contains("treasure_id");
    }

    @Test
    void keepsEveryCollectionTiedToItsPlayer() {
        for (String table : List.of("level_stars", "completed_levels", "unlocked_levels",
                                    "claimed_achievements", "special_achievements",
                                    "player_collected_treasures", "player_cards")) {
            assertThat(columnsOf(table)).as("%s", table).contains("player_id");
        }
    }
}
