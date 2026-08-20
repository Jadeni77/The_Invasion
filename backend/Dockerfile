# The backend, built and run in one place, so a host only needs Docker.
#
# Works unchanged on Render, Koyeb, Cloud Run or a plain VM - nothing in here
# names a provider. What a host must supply is the environment: see
# docs/deployment.md for the five variables and what happens without them.

# --- build -------------------------------------------------------------------
# JDK 21 rather than the JDK 24 on the developer's machine. Lombok trails new
# JDK releases - 1.18.30 could not compile under 24 at all - and pinning the
# build to an LTS keeps that failure out of the deployment.
FROM eclipse-temurin:21-jdk AS build

WORKDIR /build

# Dependencies resolve from the POM alone, so this layer is rebuilt only when
# the POM changes - not on every source edit.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src/ src/
RUN ./mvnw -B -q -DskipTests package

# --- run ---------------------------------------------------------------------
# JRE, not JDK: the compiler is dead weight in the image that actually ships.
FROM eclipse-temurin:21-jre AS runtime

# Not root. A container that is only ever a web server has no use for it.
RUN useradd --system --create-home --shell /usr/sbin/nologin invasion
USER invasion

WORKDIR /app
COPY --from=build --chown=invasion:invasion /build/target/*.jar app.jar

# The port the host asks for. Render and most others assign one through PORT;
# application.properties reads it with 8080 as the local default.
ENV PORT=8080
EXPOSE 8080

# MaxRAMPercentage, and NOT because the JVM mistakes the host for the container:
# it has read cgroup limits since Java 10, and container support is on by
# default. The problem is the default share. 25% of a 512MB instance is a ~128MB
# heap, which leaves most of the box unused and the app hitting GC pressure it
# has the memory to avoid. 70% claims the room while still leaving space for the
# JVM's own non-heap use - metaspace, thread stacks, code cache - which is why
# this is not higher.
#
# SerialGC because a free instance gets a fraction of a core: a parallel
# collector spends more on coordinating threads than it recovers.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"

# Shell form, so ${JAVA_OPTS} is expanded rather than passed as one literal word.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
